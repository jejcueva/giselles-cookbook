# AWS Migration — Design

**Date:** 2026-10-18
**Status:** Approved design, awaiting implementation plan

## Goal

Move Cute Cookbook off Vercel + Supabase onto AWS, with all infrastructure owned in one AWS account and defined as code. Drivers: AWS learning/portfolio value and consolidation. Hard constraint: total AWS spend must stay under a $200 credit for at least 12 months (≈ $16/mo ceiling, with margin).

Existing data (recipes, categories, photos) must be preserved. Downtime during cutover is acceptable.

## Decisions

| Area | Decision | Rejected alternatives |
|---|---|---|
| Compute | Lightsail Container Service, power `micro` (1 GB), scale 1 | Lightsail VM (cheaper, more ops); Amplify/Lambda (Next.js 16 support risk) |
| Database | DynamoDB single table, on-demand | RDS (~$14/mo alone, exhausts credits ~month 10); Postgres on the VM (weak portfolio story); Aurora Serverless v2 (cold starts) |
| Images | Private S3 behind CloudFront (OAC), presigned PUT uploads | Public bucket (less secure, no CDN) |
| IaC | AWS CDK (TypeScript) in `infra/` | Terraform (second toolchain); console-only (not reproducible) |
| App data access | Route Handlers + repository layer; pages stay client components | Server Actions (off-idiom for reads); RSC refactor (deferred, see Follow-ups) |
| Deploy | GitHub Actions on push to `main` → Lightsail image push + deployment | Vercel; CDK in CI (needs broad IAM in GitHub) |
| Cutover | One-shot migration script + maintenance window | Zero-downtime dual-write (not worth it for one user) |
| Region | `us-east-1` for everything | `us-west-2` + cross-region cert stack (extra plumbing) |

**Estimated cost:** ~$10/mo (Lightsail) + cents (S3, DynamoDB, CloudFront within always-free tiers) ≈ $125/yr.

## Current state (for reference)

- Next.js 16 App Router; every page is `"use client"`. Hosted on Vercel via `.github/workflows/vercel-deploy.yml`.
- Supabase Postgres accessed **directly from the browser** with the anon key (~20 `supabase.from(...)` call sites across 7 pages). No RLS policies exist in `supabase/migrations`.
- Supabase Storage public bucket `recipe-photos`, uploaded from the browser.
- Custom HMAC cookie auth (`src/lib/auth-session.ts`, `src/middleware.ts`); roles `owner` / `recruiter` from `/api/auth/session`. `canWrite` is enforced only in the UI today.
- Server routes: `/api/chat` (Gemini), `/api/scrape-recipe`, `/api/parse-recipe`, `/api/import-recipe`, `/api/auth/*`.
- `profiles` table is unused; onboarding flags live in `localStorage`.

## 1. DynamoDB data model

**Table `cute-cookbook`** — `PK` (S), `SK` (S); GSI `GSI1` on `GSI1PK` (S) / `GSI1SK` (S), projection ALL. On-demand billing, point-in-time recovery enabled, `RemovalPolicy.RETAIN`.

### Recipe item

| Attribute | Value |
|---|---|
| `PK` | `RECIPE#<id>` (existing Supabase UUID preserved) |
| `SK` | `RECIPE` |
| `GSI1PK` | `RECIPE` |
| `GSI1SK` | `<createdAt ISO-8601>#<id>` |
| data | `title`, `ingredients[]` (`{name, amount, unit}`), `instructions[]` (`{stepNumber, text}`), `notes`, `sourceUrl`, `cookTime`, `prepTime`, `servings`, `calories`, `protein`, `carbs`, `fat`, `isFavorite`, `categoryIds[]`, `tags[]`, `photos[]` (`{key, sortOrder}`), `coverImage`, `createdAt`, `updatedAt` |

`coverImage` is either an S3 object key (`covers/<uuid>.<ext>`) or an external `https://` URL kept from a blog import. The repository resolves keys to CloudFront URLs on read; clients only ever see URLs.

Listing (home, recipes, favorites, category pages) is one `Query` on `GSI1PK=RECIPE`, `ScanIndexForward=false`. Favorite and category filtering is applied in the repository over that result. The repository paginates (`LastEvaluatedKey`) so growth past a 1 MB page is handled. No sparse indexes until there is a measured need.

### Category item

| Attribute | Value |
|---|---|
| `PK` | `CATEGORY#<id>` |
| `SK` | `CATEGORY` |
| `GSI1PK` | `CATEGORY` |
| `GSI1SK` | `<name lowercased>` |
| data | `name`, `emoji`, `createdAt` |

**Uniqueness item** `PK=CATEGORYNAME#<name lowercased>`, `SK=CATEGORYNAME`, written in a `TransactWriteItems` with `attribute_not_exists(PK)` alongside the category. Rename replaces the uniqueness item in the same transaction. Delete removes both items and then removes the category id from every recipe referencing it (query GSI1, filter, `UpdateItem` each).

### Not migrated

`profiles` (dead table). `recipe_tags`, `recipe_photos`, `recipe_categories` are folded into the recipe item.

## 2. Image pipeline

- **Bucket:** private, Block Public Access on, versioning off, lifecycle rule aborting incomplete multipart uploads after 1 day, CORS allowing `PUT` from `https://cutecookbook.com`. `RemovalPolicy.RETAIN`.
- **Keys:** `covers/<uuid>.<ext>`; reserved `photos/<recipeId>/<uuid>.<ext>` for gallery photos.
- **Reads:** CloudFront distribution, S3 origin with Origin Access Control, custom domain `img.cutecookbook.com` with an ACM certificate (us-east-1). `next.config.ts` `images.remotePatterns` whitelists `img.cutecookbook.com` and drops the Supabase host.
- **Uploads:** `POST /api/uploads/presign` (owner only). Body `{ fileName, contentType, size }`. Validates `contentType ∈ {image/jpeg, image/png, image/webp, image/heic}` and `size ≤ 10 MB`. Returns `{ key, uploadUrl }` where `uploadUrl` is a presigned S3 `PUT` valid 5 minutes. Client PUTs the file, then sends `key` in the recipe create/update payload.
- **Deletes:** on recipe delete or cover replacement, the repository deletes the old S3 object. Best-effort: failures are logged and never fail the user's request.
- **Credentials:** Lightsail containers cannot assume IAM roles, so the app uses IAM user `cute-cookbook-app` with a policy limited to `dynamodb:GetItem/PutItem/UpdateItem/DeleteItem/Query/BatchWriteItem/TransactWriteItems` on the table and its index, and `s3:PutObject/GetObject/DeleteObject` on `bucket/*`. Keys are supplied as container environment variables, never baked into the image.

## 3. Application changes

### New modules

- `src/lib/types.ts` — `Recipe`, `RecipeSummary`, `Category`, `Ingredient`, `InstructionStep`, `RecipePhoto`.
- `src/lib/db/client.ts` — DynamoDB DocumentClient from env (`AWS_REGION`, `TABLE_NAME`).
- `src/lib/db/keys.ts` — key and GSI value builders.
- `src/lib/db/recipes-repo.ts` — `list({ favorite?, categoryId? })`, `getById(id)`, `create(input, { id?, createdAt?, updatedAt? })` (overrides used only by the migration), `update(id, patch)`, `delete(id)`, `setFavorite(id, value)`.
- `src/lib/db/categories-repo.ts` — `list()`, `getById(id)`, `create(input, { id? })`, `rename(id, name)`, `setEmoji(id, emoji)`, `delete(id)`.
- `src/lib/db/errors.ts` — `NotFoundError`, `ConflictError`.
- `src/lib/storage/s3.ts` — `presignUpload()`, `deleteObject(key)`, `toPublicUrl(keyOrUrl)`.
- `src/lib/api-client.ts` — typed `fetch` wrappers: `api.recipes.*`, `api.categories.*`, `api.uploads.presign(file)`. Throws `ApiError` on non-2xx.
- `src/lib/api-route.ts` — `handleRoute()`, `requireViewer()`, `requireOwner()`, error → status mapping.
- `src/lib/config.ts` — reads and validates required env at startup (fail fast in production).

### Route handlers

| Route | Methods | Auth |
|---|---|---|
| `/api/recipes` | `GET` (`?favorite=1`, `?category=<id>`), `POST` | viewer / owner |
| `/api/recipes/[id]` | `GET`, `PATCH`, `DELETE` | viewer / owner / owner |
| `/api/recipes/[id]/favorite` | `POST` `{ value }` | owner |
| `/api/categories` | `GET`, `POST` | viewer / owner |
| `/api/categories/[id]` | `GET`, `PATCH` (`name`, `emoji`), `DELETE` | viewer / owner / owner |
| `/api/uploads/presign` | `POST` | owner |
| `/api/share/[id]` | `GET` | public (middleware bypass) |
| `/api/health` | `GET` | public (middleware bypass) |

Bodies are validated with `zod`. Errors return `{ error: string }` with 400/401/403/404/409/500.

### Pages updated (UI unchanged, data calls swapped)

`src/app/page.tsx`, `recipes/page.tsx`, `recipes/[id]/page.tsx`, `recipes/new/page.tsx`, `recipes/[id]/edit/page.tsx`, `categories/page.tsx`, `categories/[id]/page.tsx`, `favorites/page.tsx`, `ai-assistant/page.tsx`, `share/[id]/page.tsx`. `api/chat/route.ts` reads recipe context through `recipes-repo`.

### Removed

`src/lib/supabase.ts`, `src/lib/storage-images.ts`, `@supabase/supabase-js`, `NEXT_PUBLIC_SUPABASE_*` env vars, `.vercel/`, `vercel-deploy.yml`. The `supabase/` directory, `pg`, and `tsx` are removed in a final cleanup commit **after** cutover is verified, since the migration script depends on them.

### Unchanged

Auth cookie/session, middleware (plus two bypass paths), in-memory rate limiter (single container), `/api/scrape-recipe`, `/api/parse-recipe`, `/api/import-recipe`, themes, all components.

## 4. Infrastructure (CDK)

`infra/` is a standalone npm package (`aws-cdk-lib`, `constructs`, `vitest`). Region `us-east-1`. Three stacks, deployed in order:

**`CuteCookbookCertificates`** — certificates live in their own stack because manually-validated ACM certificates hold a CloudFormation stack in `CREATE_IN_PROGRESS` until the validation CNAME exists (72-hour timeout); isolating them keeps the data stack's deploy independent.
- ACM certificate `img.cutecookbook.com` (DNS validation, records added manually at the DNS provider).
- `AWS::Lightsail::Certificate` `cute-cookbook-site` for `cutecookbook.com` + `www.cutecookbook.com` (validation CNAMEs also added manually; Lightsail requires the certificate to be issued before it can be attached to a container service).
- Outputs: `ImageCertificateArn`, `SiteCertificateName`.

**`CuteCookbookData`**
- DynamoDB table per §1.
- S3 bucket per §2. CORS origins: `https://cutecookbook.com`, `https://www.cutecookbook.com`, and `http://localhost:3000` (local development needs presigned PUTs too).
- CloudFront distribution with OAC to the bucket, HTTPS only, default caching, using the ACM certificate from the certificates stack.
- IAM user `cute-cookbook-app` + inline policy per §2.
- Outputs: `TableName`, `BucketName`, `ImageCdnDomainName` (the `*.cloudfront.net` name the `img` CNAME points at), `AppUserName`.

**`CuteCookbookCompute`**
- IAM user `cute-cookbook-deploy` + inline policy per §5.
- `AWS::Lightsail::Container` service `cute-cookbook`, power `micro`, scale 1, public domain names attached to `cute-cookbook-site` — **created only when the CDK context flag `containerService=true` is set.** Lightsail bills a container service from creation ($10/mo) whether enabled, disabled, or empty, so the service is not created until Phase 6, immediately before the first deployment.
- No `ContainerServiceDeployment` in CDK — deployments are driven by CI (§5).

**Container image** — `Dockerfile`: multi-stage on `node:22-alpine` (Node 20 is EOL; CI also runs Node 22), `next build` with `output: "standalone"`, runtime stage copies `.next/standalone`, `.next/static`, `public`, runs as non-root, exposes 3000. `.dockerignore` excludes `node_modules`, `.next`, `.env*`, `infra`, `docs`.

**DNS** — Lightsail DNS zone for `cutecookbook.com` (free; supports apex alias to container services). Registrar nameservers point at it. Records: apex alias → container service, `www` CNAME → container service, `img` CNAME → CloudFront, plus ACM and Lightsail certificate validation CNAMEs.

**Runtime environment variables**
`AWS_REGION`, `TABLE_NAME`, `BUCKET_NAME`, `IMAGE_CDN_HOST`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AUTH_SESSION_SECRET`, `AUTH_PASSWORD_GISELLEMYLUV`, `AUTH_PASSWORD_TEST`, `AUTH_PASSWORD_RECRUITER`, `GEMINI_API_KEY`, `SCRAPER_API_KEY`, `NODE_ENV=production`.

## 5. Deploy pipeline

`.github/workflows/deploy.yml`, triggered on push to `main`. `ci.yml` continues to run lint/typecheck/build/tests on PRs and gains a `docker build` step.

1. Checkout, Node 20, `npm ci`, lint, test, build.
2. Configure AWS credentials from GitHub Secrets — IAM user `cute-cookbook-deploy` with only `lightsail:CreateContainerServiceRegistryLogin`, `lightsail:RegisterContainerImage`, `lightsail:CreateContainerServiceDeployment`, `lightsail:GetContainerServices`, `lightsail:GetContainerServiceDeployments`, `lightsail:GetContainerImages` (the CLI's `push-container-image` is implemented with the first two). Lightsail does not support resource-level scoping for these actions, so the resource is `*`.
3. `docker build -t cute-cookbook:${GITHUB_SHA} .`
4. `aws lightsail push-container-image --service-name cute-cookbook --label app --image cute-cookbook:${GITHUB_SHA}`; capture the returned image reference.
5. Render deployment JSON: container `app` with that image, port 3000 HTTP, env vars from Secrets/Variables; public endpoint `app:3000` with health check path `/api/health`, healthy threshold 2, interval 10 s.
6. `aws lightsail create-container-service-deployment`.
7. Poll `get-container-services` until `state == RUNNING` (timeout 10 min); exit non-zero on `FAILED` or timeout.

Rollback: re-run the workflow from a known-good commit. Infra changes: `cd infra && npx cdk diff && npx cdk deploy` run manually from a developer machine.

GitHub **Secrets:** `AWS_DEPLOY_ACCESS_KEY_ID`, `AWS_DEPLOY_SECRET_ACCESS_KEY`, `APP_AWS_ACCESS_KEY_ID`, `APP_AWS_SECRET_ACCESS_KEY`, `AUTH_SESSION_SECRET`, `AUTH_PASSWORD_GISELLEMYLUV`, `AUTH_PASSWORD_TEST`, `AUTH_PASSWORD_RECRUITER`, `GEMINI_API_KEY`, `SCRAPER_API_KEY`. **Variables:** `AWS_REGION`, `TABLE_NAME`, `BUCKET_NAME`, `IMAGE_CDN_HOST`.

## 6. Migration script

`scripts/migrate-from-supabase.ts`, run locally with `npx tsx`. Dev dependencies: `pg`, `tsx`.

**Env:** `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `AWS_REGION`, `TABLE_NAME`, `BUCKET_NAME`, admin `AWS_*` credentials. Flags: `--dry-run`.

**Steps**
1. Read all rows from `recipes`, `categories`, `recipe_categories`, `recipe_tags`, `recipe_photos`; log counts.
2. Write categories via `categories-repo.create()` with original UUIDs. Abort on lowercased-name collision.
3. For every `cover_image_url` / `recipe_photos.image_url` matching `<SUPABASE_URL>/storage/v1/object/public/recipe-photos/<path>`: download, `PutObject` to `<path>` with the original content type. Skip if the object already exists. Other URLs are left as external.
4. Assemble recipe items (columns + `categoryIds` + `tags` + ordered `photos` + resolved `coverImage`) and write via `recipes-repo.create()` with original `id`, `created_at`, `updated_at`.
5. Verify: DynamoDB counts vs Postgres counts; `HeadObject` on each uploaded key; print summary and skipped items.

Idempotent by construction (`PutItem` on fixed keys, skip-existing uploads). Pure transform functions are separated from I/O for testing.

**Runbook** `docs/runbooks/aws-cutover.md`: `cdk deploy` → create access keys for app + deploy users → set GitHub Secrets/Variables → migration `--dry-run` → migration → verify → push `main` to deploy → confirm Lightsail cert validated → switch nameservers → smoke test (login, recipe page with image, create with upload, share link, AI chat, recruiter read-only) → wait a week → delete Vercel project, pause then delete Supabase project.

Rollback during the window: Supabase and Vercel are untouched by the script; pointing DNS back restores the old stack.

## 7. Error handling

- `handleRoute()` maps: zod error → 400; no session → 401; non-owner write → 403; `NotFoundError` → 404; `ConflictError` → 409; other → 500 with full error logged server-side and a generic client message.
- Repositories throw typed errors; routes never string-match messages.
- S3 object deletes are best-effort (log and continue). Everything else fails loudly.
- `src/lib/config.ts` throws at startup in production if any required env is missing, so a misconfigured deploy fails its health check and Lightsail keeps serving the previous version.
- Known cleanup (out of scope): `.env.local` file-reading fallbacks in `scrape-recipe/route.ts` are dev-only and inert in the container.

## 8. Testing

Add **Vitest** to the app and to `infra/`. `ci.yml` runs both. Coverage target 80%+ on `src/lib/db`, `src/lib/storage`, `src/app/api`.

- **Repositories** — `aws-sdk-client-mock`: key builders, GSI query parameters, favorite/category filtering, pagination, denormalization, transactional uniqueness and conflict handling, `coverImage` URL resolution.
- **Routes** — handlers invoked with `Request` objects: viewer read / recruiter write rejected / no cookie → 401, zod rejections, error mapping. Repos mocked.
- **Presign** — content-type and size validation, key format, expiry.
- **Migration** — pure transforms (row + joins → item; URL → key or passthrough) against fixtures copied from real Supabase shapes.
- **Infra** — `Template.fromStack` assertions: GSI1 present, PITR on, RETAIN policies, Block Public Access, IAM policy scoped to exactly one table ARN (+ index) and one bucket, CloudFront uses OAC.
- **Manual integration** — runbook smoke test against the real stack.
- **E2E** — deferred (see Follow-ups).

## Follow-ups (explicitly out of scope)

1. **Approach 3 — RSC + Server Actions.** Move reads into Server Components and writes into Server Actions, deleting `api-client.ts` and most `useEffect` loading states. Do this only after the AWS stack has been stable in production.
2. Playwright E2E for login, recipe CRUD with upload, share link.
3. ECR as the image registry (instead of Lightsail's built-in store) if wanted for the resume.
4. Remove the `.env.local` fallbacks from `scrape-recipe/route.ts`.
5. Sparse GSIs for favorites/categories if the recipe count ever makes in-repo filtering noticeable.

## Resume tracking

Noteworthy work is logged in `docs/resume-highlights.md`; update it as items move from `planned` to `done`.
