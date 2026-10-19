# AWS Migration — Roadmap

**Spec:** `docs/plans/2026-10-18-aws-migration-design.md`
**Resume log:** `docs/resume-highlights.md`

Each phase gets its own implementation plan (`docs/plans/2026-10-18-aws-migration-phase-N-<name>.md`) and ends with working, independently testable software. Production stays on Vercel + Supabase, untouched, until Phase 6.

## Ordering rationale

- Infra goes first because it has the longest external lead times (ACM/Lightsail certificate validation, access-key creation) and nothing else depends on it being *finished*, only on it being *started*.
- The data layer and API are built and unit-tested with mocked AWS clients, then verified against the real (empty) dev table before any page is touched.
- Pages are swapped last on the app side so the UI change is a mechanical replacement against an API that is already proven.
- Data migration runs before the first container deploy so the new stack is never live with an empty database.
- Cleanup is a separate phase so nothing Supabase-related is deleted until cutover is verified.

## Phases

### Phase 0 — Test harness & container image
Spec: §4 (container image), §8 (test tooling), §3 (`/api/health`).
- Add Vitest + `npm test` to the app; wire into `ci.yml`.
- `GET /api/health` route with middleware bypass.
- `output: "standalone"` in `next.config.ts`, multi-stage `Dockerfile`, `.dockerignore`, `docker build` step in `ci.yml`.
- **Done when:** `npm test` passes in CI; `docker build` succeeds and `docker run` serves the app locally (still against Supabase env) with `/api/health` returning 200.

### Phase 1 — Infrastructure (CDK)
Spec: §1 (table definition), §2 (bucket/CDN/IAM), §4.
- `infra/` package with `CuteCookbookCertificates`, `CuteCookbookData`, and `CuteCookbookCompute` stacks (container service gated behind a context flag and not created until Phase 6, since Lightsail bills it from creation).
- CDK assertion tests (GSI1, PITR, RETAIN, Block Public Access, IAM scoping, OAC, container gating); infra typecheck/test/synth in CI.
- `cdk bootstrap` + `cdk deploy` to us-east-1; ACM and Lightsail validation CNAMEs plus the `img` CNAME added at the current DNS provider.
- Create the access key for `cute-cookbook-app` (the deploy user's key is created in Phase 6 when it is first needed).
- **Done when:** infra tests pass locally and in CI; certificates issued; table, bucket, CDN, and IAM users exist; app credentials and stack outputs recorded in `.env.local`; a CLI round-trip (put/get item, S3 upload, CDN fetch) succeeds.

### Phase 2 — Data layer
Spec: §1, §2 (S3 module), §3 (new modules), §7 (typed errors, config).
- `src/lib/types.ts`, `src/lib/config.ts`, `src/lib/db/{client,keys,errors,recipes-repo,categories-repo}.ts`, `src/lib/storage/s3.ts`.
- Unit tests with `aws-sdk-client-mock`.
- **Done when:** repositories and S3 module pass tests at 80%+ coverage; a throwaway script can create/list/delete a recipe against the real dev table.

### Phase 3 — API routes
Spec: §3 (route table), §7 (error mapping, auth helpers).
- `src/lib/api-route.ts` (`handleRoute`, `requireViewer`, `requireOwner`), zod schemas.
- All routes under `src/app/api/{recipes,categories,uploads,share}`; middleware bypass for `/api/share/`.
- Route unit tests (auth, validation, error mapping).
- **Done when:** every route is tested; manual `curl` session against local dev + real table exercises create → presign → upload → read → favorite → delete.

### Phase 4 — Page migration
Spec: §3 (pages updated, removed).
- `src/lib/api-client.ts`.
- Swap data calls in the 10 pages and `api/chat/route.ts`; `next.config.ts` image host → `img.cutecookbook.com`.
- Remove `src/lib/supabase.ts`, `src/lib/storage-images.ts`, `@supabase/supabase-js`, `NEXT_PUBLIC_SUPABASE_*` usage from app code.
- **Done when:** the app runs locally end-to-end against AWS dev resources with zero Supabase imports; lint and tests pass; recruiter login is read-only at the API level.

### Phase 5 — Data migration
Spec: §6.
- `scripts/migrate-from-supabase.ts` with pure transforms separated from I/O; transform unit tests.
- `docs/runbooks/aws-cutover.md`.
- `--dry-run`, then real run, then verification report.
- **Done when:** DynamoDB/S3 counts match Postgres; every migrated image resolves through CloudFront; local app shows her real recipes.

### Phase 6 — Deploy pipeline & cutover
Spec: §5, §6 (runbook execution).
- `.github/workflows/deploy.yml`; GitHub Secrets/Variables populated.
- First deployment to Lightsail; health check green; Lightsail cert validated and attached.
- Lightsail DNS zone created; nameservers switched; smoke test per runbook.
- **Done when:** `https://cutecookbook.com` is served by Lightsail with migrated data; a push to `main` redeploys automatically; Vercel still exists as rollback.

### Phase 7 — Decommission & cleanup
Spec: §3 (removed, post-cutover), Follow-ups.
- After ≥ 1 week stable: delete Vercel project and `vercel-deploy.yml`, `.vercel/`; pause then delete Supabase project.
- Remove `supabase/`, `pg`, `tsx`; update `README.md` tech stack and architecture; flip `docs/resume-highlights.md` entries to `done`.
- **Done when:** no Supabase or Vercel references remain in the repo except in historical plan docs.

## Follow-ups (not in this roadmap)

Tracked in the spec: RSC + Server Actions refactor (Approach 3), Playwright E2E, ECR registry, `scrape-recipe` env fallback cleanup, sparse GSIs.
