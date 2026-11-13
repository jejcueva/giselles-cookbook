# AWS Migration — Phase 3: API routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1–6 are code; Task 7 is a guided human smoke test against existing AWS resources. Task 8 opens the implementation PR. This document is a plan, not evidence that these tasks have run.

**Goal:** Expose the Phase 2 data layer through validated Next.js Route Handlers, enforce viewer/owner permissions at every protected endpoint, expose a deliberately projected public share response, and verify the local API against the existing AWS table and bucket before any page switches away from Supabase.

**Architecture:** `api-schemas.ts` defines strict Zod request contracts. `api-route.ts` centralizes cookie verification, owner and same-origin checks, bounded JSON parsing, no-store responses, and typed error mapping. A separate process-local limiter protects the new endpoints without changing login lockouts. Route handlers authenticate and validate before lazily importing repositories/S3. Exact new API patterns bypass page middleware and enforce their own auth, producing JSON errors instead of redirects. Category name-plus-emoji PATCH uses one existing DynamoDB transaction through a small repository extension.

**Tech Stack:** Existing Next.js 16.1.6, React 19, TypeScript 5, Node 22+, Vitest 5, `@vitest/coverage-v8`, Phase 2 AWS SDK v3 repositories; add only missing `zod@^4`. Native `Request`/`Response` tests; existing `aws-sdk-client-mock` for the narrow category repository change.

**Spec:** `docs/plans/2026-10-18-aws-migration-design.md` §3 (route table), §7 (auth and error mapping), §8 (route/presign testing); Phase 2's implemented `src/lib/types.ts`, repositories, storage, and config are the interfaces to consume. Preserve string ingredient amounts/units, camelCase fields, nullable numeric values, and nullable emoji. Follow [Next.js Route Handler signatures](https://nextjs.org/docs/app/api-reference/file-conventions/route) with asynchronous route params, and [Zod 4 schemas](https://zod.dev/api).
**Roadmap:** `docs/plans/2026-10-18-aws-migration-roadmap.md` — Phase 3 only. API client/page migration is Phase 4.

## Global Constraints

- This authoring task creates only this plan. During future execution, implement only the files listed below. Do not edit previous plans, infra, deployment workflows, DNS, certificates, or auth credential/session formats.
- Production stays on Vercel + Supabase. Keep all pages, `api/chat`, `api-client.ts`, `next.config.ts`, Supabase modules/dependencies, and existing login/logout/session handlers untouched. API authorization protects the new AWS endpoints; it does not claim to close direct Supabase access before Phase 4.
- Reuse project `592685885054`, selected Region `us-east-2`, CLI profile `cute-cookbook-project`, table `cute-cookbook`, bucket `cutecookbookdata-imagesbucket1e86afb2-lnm24xf2wzzn`, CDN `d2gmo95al03pdi.cloudfront.net`. Phase 2's resume claim is now `done`; reuse its app key from ignored `.env.local`. Create no access keys or resources. The deploy user still gets no key until Phase 6.
- `CuteCookbookCertificates` remains undeployed; CloudFormation in `us-east-1` is denied. No CDK deploy, table recreation, certificate/domain setup, Lightsail container, or production cutover. The container must remain uncreated. Old documents' `us-east-1` deployment instructions do not apply.
- Preserve Phase 2's inherited Region commits and any remaining unrelated work, including `.superpowers/`. Branch `feat/aws-migration-phase-3` from the completed Phase 2 branch, not `master`; do not reset, discard, or stage unrelated work. The Region merge and Phase 2 plan were committed during this plan's review; use the current history below.
- Protected GETs accept owner and recruiter sessions; all writes require owner. Both existing owner accounts retain access. Public share is GET only. Guard before reading bodies, validating resource IDs, importing AWS modules, or invoking repositories. Reject forged role fields; use the verified HMAC session only.
- Success bodies are the resource/array directly; DELETE is 204 with no body. Errors are `{ error: string }`: 400 invalid input/JSON, 401 no valid session, 403 recruiter write or bad Origin, 404 typed missing item, 409 typed conflict, 429 rate limit, 500 generic unexpected failure with details logged server-side. Never match repository error messages.
- Require exact same-origin `Origin` on POST/PATCH/DELETE, and `application/json` for JSON bodies. Local curl includes Origin explicitly. Existing HttpOnly/SameSite cookies stay unchanged. Do not add permissive CORS. This follows the authorization-at-the-handler guidance in [Next.js data security](https://nextjs.org/docs/app/guides/data-security).
- New endpoints share a conservative 120 requests/minute per-process budget. This small single-user app deliberately uses one stable bucket, with no spoofable forwarding-header identities or unbounded key map. It is not a distributed quota and restarts reset it. Existing failed-login limits are separate and unchanged.
- Keep AWS imports inside authorized route callbacks. Static imports of the current repositories evaluate production config and would make credential-free CI/Docker builds fail. Missing runtime config still fails on first AWS module load and returns generic 500; comprehensive startup/health readiness checks belong to deployment work, not a silent weakening of `config.ts`.
- Strict schemas reject IDs/timestamps/PK/SK and unknown nested fields. Bound actual JSON stream bytes to 256 KiB before parsing. Gallery endpoints, multipart uploads, migration scripts, cutover runbooks, and new data-model fields are out of scope.
- Tests stay colocated under `src/**/*.test.ts` using existing `vitest.config.mts` and `@/`. Mock repository/S3 calls in route tests. Target ≥80% each for statements, branches, functions, and lines on each new helper/route and the touched category repository; keep Phase 2 coverage green. No live AWS calls in tests.
- Shell is PowerShell, repository root unless stated; `;` between commands, no shell `&&`. Check native exit codes before advancing, show explicit `git add` paths, use conventional `feat:`, `test:`, `chore:`, `docs:` commits. Never stage `.env.local`, cookie jars, fixture uploads, or smoke artifacts.

## Prerequisites

- [ ] **Inspect current work and branch from Phase 2.** At final plan review the checkout is `feat/aws-migration-phase-2`: data layer through `28b14e8`, Region commit `8f6d686` inherited through merge `c07a8b4`, and tracked Phase 2 plan in `8154824`. `.superpowers/` remains unrelated/untracked.

```powershell
git status --short
git branch --show-current
git log -5 --oneline
git diff --stat
git switch feat/aws-migration-phase-2
git switch -c feat/aws-migration-phase-3
```

Expected: Phase 3 inherits completed Phase 2 commits, including the Region merge and plan, and retains every pending unrelated file. Do not stage unrelated files in this phase. Verify those Region commits remain in the branch history before PR readiness.

- [ ] **Read the actual contracts and verify the baseline.**

```powershell
Get-Content package.json
Get-Content src/lib/types.ts
Get-Content src/lib/db/recipes-repo.ts
Get-Content src/lib/db/categories-repo.ts
Get-Content src/lib/storage/s3.ts
node --version
npm test
```

Expected: Node 22+; AWS v3/mock packages installed, no root Zod yet; **11 files / 110 tests** from Phase 2. If tests changed before execution, record the actual baseline and adjust the final count using the new cases below. Do not infer live AWS readiness solely from mocked tests.

- [ ] **Verify local secret isolation and existing tooling without displaying credentials.**

```powershell
git check-ignore .env.local
git ls-files -- .env.local
node --version
gh auth status
```

Expected: `.env.local` ignored/untracked, Node 22+ supports `--env-file`, GitHub authentication succeeds. The human confirms the six AWS variables and existing auth/Supabase settings are present locally without printing the file. `IMAGE_CDN_HOST` stays the CloudFront hostname. No key creation or admin credentials in the Next.js process.

- [ ] **Before the live smoke only, confirm the selected Region and existing state.** Confirm Region in AWS Settings > View all projects > Overview > Additional Info > Region (or `~/.aws/config`); confirm paid-plan/spend status in AWS Settings > Billing.

```powershell
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
$env:AWS_PROFILE = "cute-cookbook-project"; $env:AWS_REGION = "us-east-2"
aws sts get-caller-identity --query Account --output text
aws cloudformation describe-stacks --stack-name CuteCookbookData --region us-east-2 --query "Stacks[0].StackStatus" --output text
aws lightsail get-container-services --region us-east-2 --query "containerServices[].containerServiceName"
aws iam list-access-keys --user-name cute-cookbook-deploy --query "length(AccessKeyMetadata)" --output text
```

Expected: `592685885054`, `CREATE_COMPLETE`, `[]`, `0`. These are read-only checks. If previously working operations suddenly return Access Denied, check spend-limit status before changing code or credentials. A live prerequisite failure blocks the smoke/exit, not mocked implementation work.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `package.json`, `package-lock.json` | Modify | Add Zod 4 if absent |
| `src/lib/api-schemas.ts`, `src/lib/api-schemas.test.ts` | Create | Strict request/params/query contracts matching Phase 2 |
| `src/lib/api-rate-limit.ts`, `src/lib/api-rate-limit.test.ts` | Create | Separate bounded, process-local API budget |
| `src/lib/api-route.ts`, `src/lib/api-route.test.ts` | Create | Cookie guards, Origin, bounded JSON, errors, cache policy |
| `src/lib/db/categories-repo.ts`, `src/lib/db/categories-repo.test.ts` | Modify | Atomic optional emoji in the existing rename transaction |
| `src/app/api/recipes/route.ts` | Create | Viewer list and owner create |
| `src/app/api/recipes/[id]/route.ts` | Create | Viewer detail; owner patch/delete |
| `src/app/api/recipes/[id]/favorite/route.ts` | Create | Owner explicit favorite value |
| `src/app/api/recipes/route.test.ts` | Create | Collection/detail/favorite route tests with mocked repository |
| `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts` | Create | Category collection/detail CRUD |
| `src/app/api/categories/route.test.ts` | Create | Category auth/validation/atomic-patch tests |
| `src/app/api/uploads/presign/route.ts`, `src/app/api/uploads/presign/route.test.ts` | Create | Owner-only validated upload signing |
| `src/app/api/share/[id]/route.ts`, `src/app/api/share/[id]/route.test.ts` | Create | Public, explicitly projected recipe response |
| `src/lib/route-access.ts`, `src/lib/route-access.test.ts` | Modify | Narrow handler-owned API bypass and exact static paths |
| `src/middleware.test.ts` | Create | Actual middleware-to-handler boundary and existing page behavior |
| `docs/resume-highlights.md` | Modify | Phase 3 claim planned until human API smoke succeeds |
| OS temp directory only | Temporary | Curl cookies, JSON payloads, tiny image; remove after smoke |

---

### Task 1: Zod schemas matching the existing domain types

**Files:**
- Create: `src/lib/api-schemas.ts`
- Modify: `package.json`, `package-lock.json`
- Test: `src/lib/api-schemas.test.ts`

**Interfaces:**
- Produces: `recipeCreateSchema: z.ZodType<CreateRecipeInput>`, `recipePatchSchema` with output `RecipePatch`, `categoryCreateSchema` with output `CreateCategoryInput`, `categoryPatchSchema`, `favoriteSchema`, `uploadSchema`, `idSchema`, `recipeQuerySchema` (definitions below).
- Consumes: `Ingredient`, `InstructionStep`, `RecipePhoto`, `CreateRecipeInput`, `RecipePatch`, `CreateCategoryInput` from `src/lib/types.ts`; no AWS config imports.

- [ ] **Step 1: Install only the missing dependency**

```powershell
npm install zod@^4
```

Expected: root Zod 4 runtime dependency and lockfile updated. Existing AWS/Vitest packages/scripts stay intact. Skip if Zod 4 is already installed when execution begins.

- [ ] **Step 2: Write the failing test**

Create `src/lib/api-schemas.test.ts`:

```ts
import { expect, expectTypeOf, it } from "vitest";
import type { CreateRecipeInput, RecipePatch } from "@/lib/types";
import { categoryCreateSchema, categoryPatchSchema, favoriteSchema, idSchema, recipeCreateSchema, recipePatchSchema, recipeQuerySchema, uploadSchema } from "@/lib/api-schemas";

const id = "11111111-1111-4111-8111-111111111111";
const recipe: CreateRecipeInput = {
  title: " Soup ", ingredients: [{ name: "Water", amount: "", unit: "" }],
  instructions: [{ stepNumber: 1, text: "Boil" }], notes: null, sourceUrl: "http://blog.example/soup",
  cookTime: null, prepTime: 0, servings: 1, calories: null, protein: 1.5, carbs: 2.5, fat: 0,
  isFavorite: false, categoryIds: [id], tags: ["easy"], photos: [], coverImage: null,
};
it("outputs the Phase 2 shapes and preserves nullable and fractional values", () => {
  expectTypeOf(recipeCreateSchema.parse(recipe)).toEqualTypeOf<CreateRecipeInput>();
  expectTypeOf(recipePatchSchema.parse({ title: "Soup" })).toEqualTypeOf<RecipePatch>();
  expect(recipeCreateSchema.parse(recipe)).toMatchObject({ title: "Soup", protein: 1.5, notes: null });
});
it.each(["id", "createdAt", "updatedAt", "PK", "SK", "GSI1PK"])("rejects injected %s", (field) => {
  expect(recipeCreateSchema.safeParse({ ...recipe, [field]: id }).success).toBe(false);
});
it.each([
  { title: " " }, { ingredients: [{ name: "Water", amount: 1, unit: "cup" }] },
  { instructions: [{ step_number: 1, text: "Boil" }] }, { cookTime: -1 },
  { servings: 0 }, { protein: Infinity }, { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "not-a-url" },
  { photos: [{ key: "photos/x/a.png", sortOrder: 0, id: "injected" }] },
])("rejects invalid recipe fields: %s", (patch) => {
  expect(recipeCreateSchema.safeParse({ ...recipe, ...patch }).success).toBe(false);
});
it("requires a nonempty partial patch without create defaults", () => {
  expect(recipePatchSchema.safeParse({}).success).toBe(false);
  expect(recipePatchSchema.parse({ notes: null })).toEqual({ notes: null });
});
it("accepts new cover keys and external HTTPS, but rejects unsafe image values", () => {
  expect(recipePatchSchema.parse({ coverImage: `covers/${id}.png` }).coverImage).toBe(`covers/${id}.png`);
  expect(recipePatchSchema.parse({ coverImage: "https://blog.example/a.jpg" }).coverImage).toContain("https://");
  for (const coverImage of ["http://blog.example/a.jpg", "covers/../private.png", "arbitrary/key", "data:image/png,x"]) {
    expect(recipePatchSchema.safeParse({ coverImage }).success).toBe(false);
  }
});
it("validates category creation and combined nullable patches", () => {
  expect(categoryCreateSchema.parse({ name: " Dinner ", emoji: null })).toEqual({ name: "Dinner", emoji: null });
  expect(categoryPatchSchema.parse({ name: "Lunch", emoji: null })).toEqual({ name: "Lunch", emoji: null });
  expect(categoryPatchSchema.safeParse({}).success).toBe(false);
  expect(categoryPatchSchema.safeParse({ name: " " }).success).toBe(false);
});
it("does not coerce a favorite string into a boolean", () => {
  expect(favoriteSchema.parse({ value: false })).toEqual({ value: false });
  expect(favoriteSchema.safeParse({ value: "true" }).success).toBe(false);
});
it("validates UUID params and explicit recipe query filters", () => {
  expect(idSchema.parse(id)).toBe(id);
  expect(idSchema.safeParse("RECIPE#x").success).toBe(false);
  expect(recipeQuerySchema.parse({ favorite: "1", category: id })).toEqual({ favorite: "1", category: id });
  expect(recipeQuerySchema.safeParse({ favorite: "0" }).success).toBe(false);
  expect(recipeQuerySchema.safeParse({ unexpected: "1" }).success).toBe(false);
});
it.each(["image/jpeg", "image/png", "image/webp", "image/heic"])("allows upload MIME %s", (contentType) => {
  expect(uploadSchema.parse({ fileName: "a", contentType, size: 10 * 1024 * 1024 }).size).toBe(10 * 1024 * 1024);
});
it.each([
  { fileName: " " }, { contentType: "image/gif" }, { size: 0 }, { size: -1 },
  { size: 1.5 }, { size: 10 * 1024 * 1024 + 1 },
])("rejects invalid upload metadata: %s", (patch) => {
  expect(uploadSchema.safeParse({ fileName: "x", contentType: "image/png", size: 1, ...patch }).success).toBe(false);
});
```

- [ ] **Step 3: Run it to verify it fails**

```powershell
npx vitest run src/lib/api-schemas.test.ts
```

Expected: FAIL — missing `@/lib/api-schemas`.

- [ ] **Step 4: Create the schemas**

Create `src/lib/api-schemas.ts`:

```ts
import { z } from "zod";
import type { CreateCategoryInput, CreateRecipeInput, RecipePatch } from "@/lib/types";

export const idSchema = z.string().uuid();
const text = z.string().trim().min(1);
const nullableNumber = z.number().finite().nonnegative().nullable();
const coverKey = z.string().regex(/^covers\/[0-9a-f-]{36}\.(?:jpg|png|webp|heic)$/);
const httpsUrl = z.url({ protocol: /^https$/ }).max(2048);
const sourceUrl = z.url({ protocol: /^https?$/ }).max(2048);
const recipeFields = {
  title: text.max(200),
  ingredients: z.array(z.strictObject({ name: text.max(200), amount: z.string().max(80), unit: z.string().max(80) })).max(100),
  instructions: z.array(z.strictObject({ stepNumber: z.number().int().positive(), text: text.max(2000) })).max(100),
  notes: z.string().max(20000).nullable(), sourceUrl: sourceUrl.nullable(),
  cookTime: nullableNumber, prepTime: nullableNumber, servings: z.number().int().positive().nullable(),
  calories: nullableNumber, protein: nullableNumber, carbs: nullableNumber, fat: nullableNumber,
  isFavorite: z.boolean(), categoryIds: z.array(idSchema).max(100),
  tags: z.array(text.max(80)).max(100),
  photos: z.array(z.strictObject({ key: z.string().max(1024).regex(/^photos\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.(?:jpg|png|webp|heic)$/), sortOrder: z.number().int().nonnegative() })).max(100),
  coverImage: z.union([coverKey, httpsUrl]).nullable(),
};
const create = z.strictObject(recipeFields);
export const recipeCreateSchema: z.ZodType<CreateRecipeInput> = create;
export const recipePatchSchema: z.ZodType<RecipePatch> = create.partial().refine((value) => Object.keys(value).length > 0);
export const categoryCreateSchema: z.ZodType<CreateCategoryInput> = z.strictObject({ name: text.max(100), emoji: z.string().max(32).nullable() });
export const categoryPatchSchema = z.strictObject({ name: text.max(100).optional(), emoji: z.string().max(32).nullable().optional() })
  .refine((value) => value.name !== undefined || value.emoji !== undefined);
export const favoriteSchema = z.strictObject({ value: z.boolean() });
export const uploadSchema = z.strictObject({
  fileName: text.max(255), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});
export const recipeQuerySchema = z.strictObject({ favorite: z.literal("1").optional(), category: idSchema.optional() });
```

Create requires the existing full `CreateRecipeInput`; PATCH has no default fields. Existing migration writes can still use repositories directly without API-only key restrictions. No gallery API is introduced. The byte limit in Task 2 is below DynamoDB's item limit and bounds these nested fields as a whole.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
npx vitest run src/lib/api-schemas.test.ts
npx tsc --noEmit --incremental false
git add package.json package-lock.json src/lib/api-schemas.ts src/lib/api-schemas.test.ts
git commit -m "feat: define strict AWS API request schemas"
```

Expected: all schema cases pass and type assertions compile. Do not add runtime fields or weaken validation to accommodate incorrect fixtures.

---

### Task 2: Shared API guards, bounded bodies, errors, and rate budget

**Files:**
- Create: `src/lib/api-rate-limit.ts`, `src/lib/api-route.ts`
- Modify: none
- Test: `src/lib/api-rate-limit.test.ts`, `src/lib/api-route.test.ts`

**Interfaces:**
- Produces: `createApiLimiter(limit?: number, windowMs?: number, now?: () => number): () => { allowed: boolean; retryAfter: number }`, `consumeApiLimit` of that returned type.
- Produces: `handleRoute(request: Request, operation: () => Promise<Response>): Promise<Response>`, `requireViewer(request: Request): Promise<VerifiedSession>`, `requireOwner(request: Request): Promise<VerifiedSession>`, `readJson(request: Request): Promise<unknown>`, `json(data: unknown, status?: number, headers?: HeadersInit): Response`, `RouteError` with `status: number`.
- Consumes: existing `AUTH_COOKIE_NAME`, `verifySessionToken`, `VerifiedSession`, typed repository errors; no AWS clients/config or `next/headers` ambient request context.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/api-rate-limit.test.ts`:

```ts
import { expect, it } from "vitest";
import { createApiLimiter } from "@/lib/api-rate-limit";

it("allows the limit and rejects the next request", () => {
  const consume = createApiLimiter(2, 60000, () => 0);
  expect(consume().allowed).toBe(true);
  expect(consume().allowed).toBe(true);
  expect(consume()).toEqual({ allowed: false, retryAfter: 60 });
});
it("starts a fresh window at expiry", () => {
  let time = 0;
  const consume = createApiLimiter(1, 60000, () => time);
  consume(); time = 59500;
  expect(consume()).toEqual({ allowed: false, retryAfter: 1 });
  time = 60000;
  expect(consume().allowed).toBe(true);
});
it("keeps independent limiter instances and default configuration", () => {
  const first = createApiLimiter(1);
  const second = createApiLimiter();
  first();
  expect(first().allowed).toBe(false);
  expect(second().allowed).toBe(true);
});
```

Create `src/lib/api-route.test.ts`:

```ts
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth-session";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { consumeApiLimit } from "@/lib/api-rate-limit";
import { handleRoute, json, readJson, requireOwner, requireViewer, RouteError } from "@/lib/api-route";

vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret");
  vi.mocked(consumeApiLimit).mockReturnValue({ allowed: true, retryAfter: 0 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function request(username = "test", method = "GET", body?: string, origin = "https://cookbook.example") {
  const token = await createSessionToken(username);
  return new Request("https://cookbook.example/api/recipes", { method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin, "content-type": "application/json" }, body });
}

it.each(["test", "gisellemyluv", "recruiter"])("accepts a verified %s viewer", async (username) => {
  expect((await requireViewer(await request(username))).username).toBe(username);
});
it.each([undefined, "bad", "a.b.c", "a.%%%", "x".repeat(5000)])("rejects missing or malformed token %s", async (token) => {
  const req = new Request("https://cookbook.example/api/recipes", { headers: token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {} });
  const response = await handleRoute(req, async () => { await requireViewer(req); return json({}); });
  expect(response.status).toBe(401);
});
it("does not turn production secret misconfiguration into unauthenticated", async () => {
  const req = await request();
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("AUTH_SESSION_SECRET", "");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await handleRoute(req, async () => { await requireViewer(req); return json({}); });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Internal server error" });
  expect(log).toHaveBeenCalled();
});
it("rejects expired and tampered signed cookies", async () => {
  const expired = await request();
  vi.useFakeTimers();
  try {
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect((await handleRoute(expired, async () => { await requireViewer(expired); return json({}); })).status).toBe(401);
  } finally { vi.useRealTimers(); }
  const tampered = await request();
  const cookie = tampered.headers.get("cookie")!;
  tampered.headers.set("cookie", `${cookie.slice(0, cookie.lastIndexOf("."))}.AA`);
  expect((await handleRoute(tampered, async () => { await requireViewer(tampered); return json({}); })).status).toBe(401);
});
it.each(["POST", "PATCH", "DELETE"])("rejects recruiter %s before reading a body", async (method) => {
  const req = await request("recruiter", method);
  const response = await handleRoute(req, async () => { await requireOwner(req); return json({}); });
  expect(response.status).toBe(403);
  expect(req.bodyUsed).toBe(false);
});
it.each(["https://evil.example", "null", ""])("rejects a write Origin of %s", async (origin) => {
  const req = await request("test", "POST", "{}", origin);
  const response = await handleRoute(req, async () => { await requireOwner(req); return json({}); });
  expect(response.status).toBe(403);
});
it("keeps a POST body readable after the owner guard", async () => {
  const req = await request("test", "POST", '{"title":"Soup"}');
  await requireOwner(req);
  expect(req.bodyUsed).toBe(false);
  expect(await readJson(req)).toEqual({ title: "Soup" });
});
it("maps invalid JSON to 400 without hiding unrelated SyntaxErrors", async () => {
  const req = await request("test", "POST", "{");
  expect((await handleRoute(req, async () => json(await readJson(req)))).status).toBe(400);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const error = await handleRoute(await request(), async () => { throw new SyntaxError("Repository defect"); });
  expect(error.status).toBe(500);
});
it("rejects wrong media type and empty JSON", async () => {
  const wrongType = new Request("https://cookbook.example/api/recipes", { method: "POST", body: "{}" });
  await expect(readJson(wrongType)).rejects.toMatchObject({ status: 400 });
  await expect(readJson(await request("test", "POST"))).rejects.toMatchObject({ status: 400 });
});
it("limits actual streamed bytes without trusting Content-Length", async () => {
  const req = new Request("https://cookbook.example/api/recipes", {
    method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(256 * 1024 + 1),
  });
  await expect(readJson(req)).rejects.toMatchObject({ status: 400 });
});
it.each([
  [new NotFoundError("Recipe not found"), 404, "Recipe not found"],
  [new ConflictError("Name exists"), 409, "Name exists"],
  [new RouteError(403, "Forbidden"), 403, "Forbidden"],
])("maps a typed error: %s", async (error, status, message) => {
  const response = await handleRoute(await request(), async () => { throw error; });
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: message });
});
it("maps Zod errors to 400 and never returns internal messages", async () => {
  const invalid = await handleRoute(await request(), async () => { z.string().parse(1); return json({}); });
  expect(invalid.status).toBe(400);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const internal = await handleRoute(await request(), async () => { throw new Error("secret-internal-detail"); });
  expect(await internal.json()).toEqual({ error: "Internal server error" });
});
it("sets no-store on success and bodyless deletes", async () => {
  const response = await handleRoute(await request(), async () => json({ ok: true }, 201, { Location: "/api/recipes/x" }));
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("location")).toBe("/api/recipes/x");
  const deleted = await handleRoute(await request(), async () => new Response(null, { status: 204 }));
  expect(await deleted.text()).toBe("");
  expect(deleted.headers.get("cache-control")).toBe("no-store");
});
it("returns 429 and Retry-After before running an operation", async () => {
  vi.mocked(consumeApiLimit).mockReturnValue({ allowed: false, retryAfter: 12 });
  const operation = vi.fn();
  const response = await handleRoute(await request(), operation);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("12");
  expect(operation).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them to verify they fail**

```powershell
npx vitest run src/lib/api-rate-limit.test.ts src/lib/api-route.test.ts
```

Expected: FAIL — the new helper modules do not exist.

- [ ] **Step 3: Create both modules**

Create `src/lib/api-rate-limit.ts`:

```ts
export function createApiLimiter(limit = 120, windowMs = 60000, now: () => number = Date.now) {
  let state = { count: 0, resetAt: 0 };
  return (): { allowed: boolean; retryAfter: number } => {
    const time = now();
    const current = time >= state.resetAt ? { count: 0, resetAt: time + windowMs } : state;
    if (current.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - time) / 1000)) };
    state = { ...current, count: current.count + 1 };
    return { allowed: true, retryAfter: 0 };
  };
}
export const consumeApiLimit = createApiLimiter();
```

Create `src/lib/api-route.ts`:

```ts
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { AUTH_COOKIE_NAME, verifySessionToken, type VerifiedSession } from "@/lib/auth-session";
import { NotFoundError, ConflictError } from "@/lib/db/errors";
import { consumeApiLimit } from "@/lib/api-rate-limit";

export class RouteError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "RouteError"; }
}
export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export async function requireViewer(request: Request): Promise<VerifiedSession> {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SESSION_SECRET) {
    throw new Error("AUTH_SESSION_SECRET is required");
  }
  const jar = new NextRequest(request.url, { headers: request.headers }).cookies;
  const token = jar.get(AUTH_COOKIE_NAME)?.value;
  if (!token || token.length > 4096 || token.split(".").length !== 2) throw new RouteError(401, "Unauthorized");
  let session: VerifiedSession | null;
  try {
    session = await verifySessionToken(token);
  } catch (error) {
    if (!(error instanceof SyntaxError) && !(error instanceof DOMException)) throw error;
    session = null;
  }
  if (!session) throw new RouteError(401, "Unauthorized");
  return session;
}

export async function requireOwner(request: Request): Promise<VerifiedSession> {
  const viewer = await requireViewer(request);
  if (viewer.role !== "owner") throw new RouteError(403, "Forbidden");
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new RouteError(403, "Invalid origin");
  return viewer;
}

export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RouteError(400, "Expected application/json");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RouteError(400, "Invalid JSON body");
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 256 * 1024) { await reader.cancel(); throw new RouteError(400, "JSON body is too large"); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(text); }
  catch (error) {
    if (error instanceof SyntaxError) throw new RouteError(400, "Invalid JSON body");
    throw error;
  }
}

function errorResponse(error: unknown, request: Request): Response {
  if (error instanceof RouteError) return json({ error: error.message }, error.status);
  if (error instanceof ZodError) return json({ error: "Invalid request" }, 400);
  if (error instanceof NotFoundError) return json({ error: error.message }, 404);
  if (error instanceof ConflictError) return json({ error: error.message }, 409);
  console.error("API request failed", { method: request.method, path: new URL(request.url).pathname, error });
  return json({ error: "Internal server error" }, 500);
}

export async function handleRoute(request: Request, operation: () => Promise<Response>): Promise<Response> {
  let response: Response;
  try {
    const budget = consumeApiLimit();
    response = budget.allowed ? await operation() : json({ error: "Too many requests" }, 429, { "Retry-After": String(budget.retryAfter) });
  } catch (error) { response = errorResponse(error, request); }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
}
```

The header-only `NextRequest` is intentional: wrapping the original POST request can transfer its stream and make its body unusable. The catch around token verification handles malformed input narrowly; production configuration failures still become logged 500. The limiter uses one immutable record per process and never consumes the failed-login budget.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/lib/api-rate-limit.test.ts src/lib/api-route.test.ts
npx tsc --noEmit --incremental false
git add src/lib/api-rate-limit.ts src/lib/api-rate-limit.test.ts src/lib/api-route.ts src/lib/api-route.test.ts
git commit -m "feat: add guarded API execution and bounded JSON parsing"
```

Expected: helper tests pass, including POST body preservation, actual byte limit, no-store, and config-error distinction; typecheck passes.

---

### Task 3: Make combined category name/emoji updates atomic

**Files:**
- Create: none
- Modify: `src/lib/db/categories-repo.ts` (only `rename`), `src/lib/db/categories-repo.test.ts` (append cases)
- Test: existing category repository suite plus cases below

**Interfaces:**
- Produces: `categoriesRepo.rename(id: string, inputName: string, patch?: { emoji?: string | null }): Promise<Category>`; existing two-argument calls keep their behavior.
- Consumes: existing `getById`, `cleanName`, key builders, and `transact` in that module. No new table fields, transaction type, index, or resource.

- [ ] **Step 1: Append the failing tests**

Append inside the existing `describe("categoriesRepo", ...)` in `src/lib/db/categories-repo.test.ts`. Reuse its existing `ddb`, `category`, `tx`, and `canceled` fixtures; do not replace the Phase 2 cases.

```ts
it("renames and sets emoji in the same transaction action", async () => {
  const result = await categoriesRepo.rename("c1", "Lunch", { emoji: "L" });
  expect(result).toMatchObject({ name: "Lunch", emoji: "L" });
  expect(tx()[0].Update).toMatchObject({
    UpdateExpression: "SET #name = :name, GSI1SK = :sort, emoji = :emoji",
    ExpressionAttributeValues: { ":name": "Lunch", ":sort": "lunch", ":old": "Dinner", ":emoji": "L" },
  });
  expect(tx()).toHaveLength(3);
  expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
});
it("clears emoji in a case-only rename without duplicate lock actions", async () => {
  expect(await categoriesRepo.rename("c1", "DINNER", { emoji: null })).toMatchObject({ name: "DINNER", emoji: null });
  expect(tx()).toHaveLength(1);
  expect(tx()[0].Update?.ExpressionAttributeValues![":emoji"]).toBeNull();
});
it("keeps an omitted emoji untouched", async () => {
  ddb.on(GetCommand).resolves({ Item: { ...category, emoji: "D" } });
  expect((await categoriesRepo.rename("c1", "Lunch", {})).emoji).toBe("D");
  expect(tx()[0].Update?.UpdateExpression).not.toContain("emoji");
});
it("does not apply a separate emoji write when name uniqueness conflicts", async () => {
  ddb.on(TransactWriteCommand).rejects(canceled(["None", "None", "ConditionalCheckFailed"]));
  await expect(categoriesRepo.rename("c1", "Lunch", { emoji: "L" })).rejects.toBeInstanceOf(ConflictError);
  expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
});
```

- [ ] **Step 2: Prove RED**

```powershell
npx vitest run src/lib/db/categories-repo.test.ts
npx tsc --noEmit --incremental false
```

Expected: new atomic-patch tests fail; typecheck also rejects the third argument until the interface changes.

- [ ] **Step 3: Replace only the existing rename function**

Keep all imports, other functions, transaction error mapping, and exports unchanged in `src/lib/db/categories-repo.ts`. Replace `rename` with:

```ts
async function rename(id: string, inputName: string, patch: { emoji?: string | null } = {}): Promise<Category> {
  const name = cleanName(inputName);
  const current = await getById(id);
  const emojiPatch = patch.emoji !== undefined ? { emoji: patch.emoji } : {};
  const update = { Update: {
    TableName: tableName, Key: categoryKey(id), ConditionExpression: "attribute_exists(PK) AND #name = :old",
    UpdateExpression: `SET #name = :name, GSI1SK = :sort${patch.emoji !== undefined ? ", emoji = :emoji" : ""}`,
    ExpressionAttributeNames: { "#name": "name" },
    ExpressionAttributeValues: {
      ":name": name, ":sort": name.toLowerCase(), ":old": current.name,
      ...(patch.emoji !== undefined ? { ":emoji": patch.emoji } : {}),
    },
  } };
  const sameKey = current.name.toLowerCase() === name.toLowerCase();
  const items = sameKey ? [update] : [
    update,
    { Delete: { TableName: tableName, Key: categoryNameKey(current.name) } },
    { Put: { TableName: tableName, Item: categoryNameKey(name), ConditionExpression: "attribute_not_exists(PK)" } },
  ];
  await transact(items, sameKey ? [] : [2], id);
  return { ...current, name, ...emojiPatch };
}
```

Sequential `rename` then `setEmoji` would permit a partly applied PATCH if the second write failed. This extension puts both fields in the transaction already responsible for name uniqueness; no ad hoc rollback or broader repository rewrite is needed.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/lib/db/categories-repo.test.ts
npx tsc --noEmit --incremental false
git add src/lib/db/categories-repo.ts src/lib/db/categories-repo.test.ts
git commit -m "feat: support atomic category name and emoji patches"
```

Expected: existing 21 cases plus **4 new cases**, **25 category repository tests**; typecheck passes.

---

### Task 4: Recipe collection, detail, and favorite routes

**Files:**
- Create: `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`, `src/app/api/recipes/[id]/favorite/route.ts`
- Modify: none
- Test: `src/app/api/recipes/route.test.ts` (covers all three recipe handler modules)

**Interfaces:**
- Produces: `GET /api/recipes?favorite=1&category=<uuid>` → `RecipeSummary[]`; `POST /api/recipes` → 201 `Recipe` with Location.
- Produces: `GET /api/recipes/[id]` → `Recipe`; `PATCH` → `Recipe`; `DELETE` → 204; `POST /api/recipes/[id]/favorite` with `{ value: boolean }` → `Recipe`.
- Handler signatures: `GET(request: Request): Promise<Response>` for collection; detail/favorite methods use `(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response>`.
- Consumes: `recipesRepo.list/getById/create/update/delete/setFavorite`, strict schemas and shared guards. Migration overrides are never passed from HTTP input.

- [ ] **Step 1: Write the failing route tests**

Create `src/app/api/recipes/route.test.ts`:

```ts
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CreateRecipeInput, Recipe } from "@/lib/types";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { recipesRepo } from "@/lib/db/recipes-repo";
import { GET as list, POST as create } from "@/app/api/recipes/route";
import { GET as get, PATCH as update, DELETE as remove } from "@/app/api/recipes/[id]/route";
import { POST as favorite } from "@/app/api/recipes/[id]/favorite/route";

vi.mock("@/lib/db/recipes-repo", () => ({ recipesRepo: {
  list: vi.fn(), create: vi.fn(), getById: vi.fn(), update: vi.fn(), delete: vi.fn(), setFavorite: vi.fn(),
} }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
const id = "11111111-1111-4111-8111-111111111111";
const input: CreateRecipeInput = {
  title: "Soup", ingredients: [], instructions: [], notes: null, sourceUrl: null,
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: false, categoryIds: [], tags: [], photos: [], coverImage: null,
};
const recipe: Recipe = { ...input, id, createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" };
const context = () => ({ params: Promise.resolve({ id }) });
async function req(method: string, body?: unknown, username: string | null = "test", query = "") {
  const token = username ? await createSessionToken(username) : "";
  return new Request(`https://cookbook.example/api/recipes${query}`, { method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin: "https://cookbook.example", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret");
  vi.mocked(recipesRepo.list).mockResolvedValue([]); vi.mocked(recipesRepo.create).mockResolvedValue(recipe);
  vi.mocked(recipesRepo.getById).mockResolvedValue(recipe); vi.mocked(recipesRepo.update).mockResolvedValue(recipe);
  vi.mocked(recipesRepo.delete).mockResolvedValue(undefined); vi.mocked(recipesRepo.setFavorite).mockResolvedValue(recipe);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("lets a recruiter list with the exact repository filters", async () => {
  const response = await list(await req("GET", undefined, "recruiter", `?favorite=1&category=${id}`));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
  expect(recipesRepo.list).toHaveBeenCalledWith({ favorite: true, categoryId: id });
});
it("lists without filters", async () => {
  expect((await list(await req("GET"))).status).toBe(200);
  expect(recipesRepo.list).toHaveBeenCalledWith({ favorite: undefined, categoryId: undefined });
});
it.each(["?favorite=0", "?category=bad", "?favorite=1&favorite=1", "?extra=1"])("rejects query %s", async (query) => {
  expect((await list(await req("GET", undefined, "test", query))).status).toBe(400);
  expect(recipesRepo.list).not.toHaveBeenCalled();
});
it("creates with 201 and no migration overrides", async () => {
  const response = await create(await req("POST", input));
  expect(response.status).toBe(201);
  expect(response.headers.get("location")).toBe(`/api/recipes/${id}`);
  expect(await response.json()).toEqual(recipe);
  expect(recipesRepo.create).toHaveBeenCalledExactlyOnceWith(input);
});
it("rejects injected create metadata", async () => {
  expect((await create(await req("POST", { ...input, id }))).status).toBe(400);
  expect(recipesRepo.create).not.toHaveBeenCalled();
});
it("allows recruiter detail reads with async params", async () => {
  expect((await get(await req("GET", undefined, "recruiter"), context())).status).toBe(200);
  expect(recipesRepo.getById).toHaveBeenCalledWith(id);
});
it("rejects invalid resource ids before repository access", async () => {
  expect((await get(await req("GET"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(recipesRepo.getById).not.toHaveBeenCalled();
});
it("passes only the supplied PATCH fields", async () => {
  expect((await update(await req("PATCH", { notes: null }), context())).status).toBe(200);
  expect(recipesRepo.update).toHaveBeenCalledWith(id, { notes: null });
});
it("does not replace an unchanged public cover URL with itself", async () => {
  const coverImage = "https://d2gmo95al03pdi.cloudfront.net/covers/old.png";
  vi.mocked(recipesRepo.getById).mockResolvedValue({ ...recipe, coverImage });
  await update(await req("PATCH", { title: "Stew", coverImage }), context());
  expect(recipesRepo.update).toHaveBeenCalledWith(id, { title: "Stew" });
});
it("passes a new cover key and explicit favorite false", async () => {
  const coverImage = `covers/${id}.png`;
  expect((await update(await req("PATCH", { coverImage }), context())).status).toBe(200);
  expect(recipesRepo.update).toHaveBeenCalledWith(id, { coverImage });
  expect((await favorite(await req("POST", { value: false }), context())).status).toBe(200);
  expect(recipesRepo.setFavorite).toHaveBeenCalledWith(id, false);
});
it("rejects empty PATCH and invalid favorite payloads", async () => {
  expect((await update(await req("PATCH", {}), context())).status).toBe(400);
  expect((await favorite(await req("POST", { value: "true" }), context())).status).toBe(400);
  expect(recipesRepo.update).not.toHaveBeenCalled(); expect(recipesRepo.setFavorite).not.toHaveBeenCalled();
});
it("deletes with a bodyless 204", async () => {
  const response = await remove(await req("DELETE"), context());
  expect(response.status).toBe(204); expect(await response.text()).toBe("");
  expect(recipesRepo.delete).toHaveBeenCalledWith(id);
});
it.each(["anonymous", "recruiter"])("blocks every mutation for %s before repository calls", async (actor) => {
  const username = actor === "anonymous" ? null : actor;
  const expected = username ? 403 : 401;
  expect((await create(await req("POST", input, username))).status).toBe(expected);
  expect((await update(await req("PATCH", { title: "Stew" }, username), context())).status).toBe(expected);
  expect((await remove(await req("DELETE", undefined, username), context())).status).toBe(expected);
  expect((await favorite(await req("POST", { value: true }, username), context())).status).toBe(expected);
  for (const method of [recipesRepo.create, recipesRepo.update, recipesRepo.delete, recipesRepo.setFavorite]) expect(method).not.toHaveBeenCalled();
});
it("rejects anonymous reads", async () => {
  expect((await list(await req("GET", undefined, null))).status).toBe(401);
  expect((await get(await req("GET", undefined, null), context())).status).toBe(401);
});
it("maps typed repository failures and hides unexpected errors", async () => {
  vi.mocked(recipesRepo.getById).mockRejectedValue(new NotFoundError("Recipe not found"));
  expect((await get(await req("GET"), context())).status).toBe(404);
  vi.mocked(recipesRepo.update).mockRejectedValue(new ConflictError("Conflict"));
  expect((await update(await req("PATCH", { title: "Stew" }), context())).status).toBe(409);
  vi.mocked(recipesRepo.list).mockRejectedValue(new Error("internal-secret"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await list(await req("GET"));
  expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Internal server error" });
});
```

- [ ] **Step 2: Prove RED**

```powershell
npx vitest run src/app/api/recipes/route.test.ts
```

Expected: FAIL — new handler imports are missing. All AWS/repository imports are mocked.

- [ ] **Step 3: Create all three route modules**

Create `src/app/api/recipes/route.ts`:

```ts
import { handleRoute, json, readJson, requireOwner, requireViewer, RouteError } from "@/lib/api-route";
import { recipeCreateSchema, recipeQuerySchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireViewer(request);
    const search = new URL(request.url).searchParams;
    for (const key of search.keys()) if (search.getAll(key).length !== 1) throw new RouteError(400, "Duplicate query parameter");
    const query = recipeQuerySchema.parse(Object.fromEntries(search));
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    return json(await recipesRepo.list({ favorite: query.favorite === "1" ? true : undefined, categoryId: query.category }));
  });
}
export async function POST(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const body = recipeCreateSchema.parse(await readJson(request));
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    const recipe = await recipesRepo.create(body);
    return json(recipe, 201, { Location: `/api/recipes/${recipe.id}` });
  });
}
```

Create `src/app/api/recipes/[id]/route.ts`:

```ts
import { handleRoute, json, readJson, requireOwner, requireViewer } from "@/lib/api-route";
import { idSchema, recipePatchSchema } from "@/lib/api-schemas";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireViewer(request);
    const id = idSchema.parse((await context.params).id);
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    return json(await recipesRepo.getById(id));
  });
}
export async function PATCH(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const body = recipePatchSchema.parse(await readJson(request));
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    let patch = body;
    if (body.coverImage !== undefined) {
      const current = await recipesRepo.getById(id);
      if (body.coverImage === current.coverImage) {
        const { coverImage, ...unchangedCoverOmitted } = body;
        void coverImage;
        patch = unchangedCoverOmitted;
      }
    }
    return json(await recipesRepo.update(id, patch));
  });
}
export async function DELETE(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    await recipesRepo.delete(id);
    return new Response(null, { status: 204 });
  });
}
```

Create `src/app/api/recipes/[id]/favorite/route.ts`:

```ts
import { handleRoute, json, readJson, requireOwner } from "@/lib/api-route";
import { favoriteSchema, idSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const { value } = favoriteSchema.parse(await readJson(request));
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    return json(await recipesRepo.setFavorite(id, value));
  });
}
```

Omitting an echoed unchanged cover URL prevents turning a stored S3 key into its own public URL and deleting the object as a supposed replacement. New uploads send the returned key. Phase 4 should also omit unchanged cover fields when building PATCH requests. Normal repository reads/writes and best-effort S3 deletion stay in Phase 2.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/app/api/recipes/route.test.ts
npx tsc --noEmit --incremental false
git add src/app/api/recipes/route.ts 'src/app/api/recipes/[id]/route.ts' 'src/app/api/recipes/[id]/favorite/route.ts' src/app/api/recipes/route.test.ts
git commit -m "feat: expose guarded recipe CRUD and favorite routes"
```

Expected: all collection/detail/favorite cases pass, with no AWS credentials/network; async params typecheck against Next.js.

---

### Task 5: Category, presign, and public share routes

**Files:**
- Create: `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts`, `src/app/api/uploads/presign/route.ts`, `src/app/api/share/[id]/route.ts`
- Modify: none
- Test: `src/app/api/categories/route.test.ts`, `src/app/api/uploads/presign/route.test.ts`, `src/app/api/share/[id]/route.test.ts`

**Interfaces:**
- Produces: viewer `GET /api/categories` → `Category[]`, owner `POST` → 201 `Category`; viewer detail GET → `Category`; owner PATCH `{ name?, emoji? }` → `Category`, DELETE → 204.
- Produces: owner `POST /api/uploads/presign` → `{ key: string; uploadUrl: string }`; public `GET /api/share/[id]` → explicit recipe projection shown below.
- Handler signatures: collection/upload `(request: Request): Promise<Response>`; dynamic routes `(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response>`.
- Consumes: `categoriesRepo.list/getById/create/rename/setEmoji/delete`, Task 3's atomic rename extension, `presignUpload(input)`, `recipesRepo.getById(id)`.

- [ ] **Step 1: Write all failing tests**

Create `src/app/api/categories/route.test.ts`:

```ts
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { categoriesRepo } from "@/lib/db/categories-repo";
import { GET as list, POST as create } from "@/app/api/categories/route";
import { GET as get, PATCH as patch, DELETE as remove } from "@/app/api/categories/[id]/route";

vi.mock("@/lib/db/categories-repo", () => ({ categoriesRepo: {
  list: vi.fn(), create: vi.fn(), getById: vi.fn(), rename: vi.fn(), setEmoji: vi.fn(), delete: vi.fn(),
} }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
const id = "11111111-1111-4111-8111-111111111111";
const category = { id, name: "Dinner", emoji: null, createdAt: "2026-10-20T00:00:00.000Z" };
const context = () => ({ params: Promise.resolve({ id }) });
async function req(method: string, body?: unknown, username: string | null = "test") {
  const token = username ? await createSessionToken(username) : "";
  return new Request("https://cookbook.example/api/categories", { method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin: "https://cookbook.example", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret");
  vi.mocked(categoriesRepo.list).mockResolvedValue([category]); vi.mocked(categoriesRepo.getById).mockResolvedValue(category);
  vi.mocked(categoriesRepo.create).mockResolvedValue(category); vi.mocked(categoriesRepo.rename).mockResolvedValue(category);
  vi.mocked(categoriesRepo.setEmoji).mockResolvedValue(category); vi.mocked(categoriesRepo.delete).mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("lets a recruiter list and read categories", async () => {
  expect(await (await list(await req("GET", undefined, "recruiter"))).json()).toEqual([category]);
  expect((await get(await req("GET", undefined, "recruiter"), context())).status).toBe(200);
});
it("creates a category with Location and no id override", async () => {
  const response = await create(await req("POST", { name: "Dinner", emoji: null }));
  expect(response.status).toBe(201); expect(response.headers.get("location")).toBe(`/api/categories/${id}`);
  expect(categoriesRepo.create).toHaveBeenCalledExactlyOnceWith({ name: "Dinner", emoji: null });
});
it("passes a name-and-emoji PATCH to one atomic repository operation", async () => {
  expect((await patch(await req("PATCH", { name: "Lunch", emoji: null }), context())).status).toBe(200);
  expect(categoriesRepo.rename).toHaveBeenCalledExactlyOnceWith(id, "Lunch", { emoji: null });
  expect(categoriesRepo.setEmoji).not.toHaveBeenCalled();
});
it("supports a name-only patch without changing emoji", async () => {
  await patch(await req("PATCH", { name: "Lunch" }), context());
  expect(categoriesRepo.rename).toHaveBeenCalledWith(id, "Lunch", {});
});
it("supports emoji-only and null emoji", async () => {
  await patch(await req("PATCH", { emoji: "L" }), context());
  await patch(await req("PATCH", { emoji: null }), context());
  expect(categoriesRepo.setEmoji).toHaveBeenNthCalledWith(1, id, "L");
  expect(categoriesRepo.setEmoji).toHaveBeenNthCalledWith(2, id, null);
  expect(categoriesRepo.rename).not.toHaveBeenCalled();
});
it.each([{}, { name: " " }, { id }, { emoji: 1 }])("rejects invalid category patch %s", async (body) => {
  expect((await patch(await req("PATCH", body), context())).status).toBe(400);
  expect(categoriesRepo.rename).not.toHaveBeenCalled(); expect(categoriesRepo.setEmoji).not.toHaveBeenCalled();
});
it("deletes with 204", async () => {
  const response = await remove(await req("DELETE"), context());
  expect(response.status).toBe(204); expect(await response.text()).toBe("");
  expect(categoriesRepo.delete).toHaveBeenCalledWith(id);
});
it.each(["anonymous", "recruiter"])("blocks all category writes for %s", async (actor) => {
  const username = actor === "anonymous" ? null : actor;
  const status = username ? 403 : 401;
  expect((await create(await req("POST", { name: "Dinner", emoji: null }, username))).status).toBe(status);
  expect((await patch(await req("PATCH", { emoji: null }, username), context())).status).toBe(status);
  expect((await remove(await req("DELETE", undefined, username), context())).status).toBe(status);
  for (const method of [categoriesRepo.create, categoriesRepo.rename, categoriesRepo.setEmoji, categoriesRepo.delete]) expect(method).not.toHaveBeenCalled();
});
it("requires a viewer for both category reads", async () => {
  expect((await list(await req("GET", undefined, null))).status).toBe(401);
  expect((await get(await req("GET", undefined, null), context())).status).toBe(401);
});
it("maps missing and conflicting categories", async () => {
  vi.mocked(categoriesRepo.getById).mockRejectedValue(new NotFoundError("Category not found"));
  expect((await get(await req("GET"), context())).status).toBe(404);
  vi.mocked(categoriesRepo.rename).mockRejectedValue(new ConflictError("Name exists"));
  expect((await patch(await req("PATCH", { name: "Lunch", emoji: "L" }), context())).status).toBe(409);
  expect(categoriesRepo.setEmoji).not.toHaveBeenCalled();
});
```

Create `src/app/api/uploads/presign/route.test.ts`:

```ts
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session";
import { presignUpload } from "@/lib/storage/s3";
import { POST } from "@/app/api/uploads/presign/route";

vi.mock("@/lib/storage/s3", () => ({ presignUpload: vi.fn() }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
const body = { fileName: "a.png", contentType: "image/png", size: 123 };
async function req(username: string | null, input: unknown = body) {
  const token = username ? await createSessionToken(username) : "";
  return new Request("https://cookbook.example/api/uploads/presign", { method: "POST",
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin: "https://cookbook.example", "content-type": "application/json" }, body: JSON.stringify(input) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret");
  vi.mocked(presignUpload).mockResolvedValue({ key: "covers/test.png", uploadUrl: "https://signed.example/put" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("signs only after owner authorization and validation", async () => {
  const response = await POST(await req("test"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ key: "covers/test.png", uploadUrl: "https://signed.example/put" });
  expect(presignUpload).toHaveBeenCalledExactlyOnceWith(body);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it.each([null, "recruiter"])("rejects signer %s", async (username) => {
  expect((await POST(await req(username))).status).toBe(username ? 403 : 401);
  expect(presignUpload).not.toHaveBeenCalled();
});
it.each([{ size: 10 * 1024 * 1024 + 1 }, { contentType: "image/gif" }, { key: "forged" }])("rejects invalid upload %s", async (patch) => {
  expect((await POST(await req("test", { ...body, ...patch }))).status).toBe(400);
  expect(presignUpload).not.toHaveBeenCalled();
});
it("hides signing failures", async () => {
  vi.mocked(presignUpload).mockRejectedValue(new Error("AWS secret detail"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await POST(await req("test"));
  expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Internal server error" });
});
```

Create `src/app/api/share/[id]/route.test.ts`:

```ts
import { beforeEach, expect, it, vi } from "vitest";
import type { Recipe } from "@/lib/types";
import { NotFoundError } from "@/lib/db/errors";
import { recipesRepo } from "@/lib/db/recipes-repo";
import { GET } from "@/app/api/share/[id]/route";

vi.mock("@/lib/db/recipes-repo", () => ({ recipesRepo: { getById: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
const id = "11111111-1111-4111-8111-111111111111";
const recipe: Recipe = {
  id, title: "Soup", ingredients: [], instructions: [], notes: "Serve warm", sourceUrl: "https://blog.example",
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: true, categoryIds: [id], tags: ["private-tag"], photos: [{ key: "photos/private/a.png", sortOrder: 0 }],
  coverImage: "https://d2gmo95al03pdi.cloudfront.net/covers/a.png",
  createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z",
};
beforeEach(() => { vi.clearAllMocks(); vi.mocked(recipesRepo.getById).mockResolvedValue(recipe); });
it("returns an explicit public projection without a session", async () => {
  const response = await GET(new Request(`https://cookbook.example/api/share/${id}`), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    id, title: "Soup", ingredients: [], instructions: [], notes: "Serve warm", coverImage: recipe.coverImage,
    cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("rejects an invalid share id", async () => {
  expect((await GET(new Request("https://cookbook.example/api/share/bad"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(recipesRepo.getById).not.toHaveBeenCalled();
});
it("returns JSON 404 for a missing public recipe", async () => {
  vi.mocked(recipesRepo.getById).mockRejectedValue(new NotFoundError("Recipe not found"));
  const response = await GET(new Request(`https://cookbook.example/api/share/${id}`), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Recipe not found" });
});
```

- [ ] **Step 2: Prove RED**

```powershell
npx vitest run src/app/api/categories/route.test.ts src/app/api/uploads/presign/route.test.ts 'src/app/api/share/[id]/route.test.ts'
```

Expected: FAIL — the new route modules do not exist; no real AWS calls.

- [ ] **Step 3: Create the four route modules**

Create `src/app/api/categories/route.ts`:

```ts
import { handleRoute, json, readJson, requireOwner, requireViewer } from "@/lib/api-route";
import { categoryCreateSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireViewer(request);
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    return json(await categoriesRepo.list());
  });
}
export async function POST(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const body = categoryCreateSchema.parse(await readJson(request));
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    const category = await categoriesRepo.create(body);
    return json(category, 201, { Location: `/api/categories/${category.id}` });
  });
}
```

Create `src/app/api/categories/[id]/route.ts`:

```ts
import { handleRoute, json, readJson, requireOwner, requireViewer } from "@/lib/api-route";
import { categoryPatchSchema, idSchema } from "@/lib/api-schemas";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireViewer(request);
    const id = idSchema.parse((await context.params).id);
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    return json(await categoriesRepo.getById(id));
  });
}
export async function PATCH(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const body = categoryPatchSchema.parse(await readJson(request));
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    if (body.name !== undefined) {
      return json(await categoriesRepo.rename(id, body.name, body.emoji !== undefined ? { emoji: body.emoji } : {}));
    }
    return json(await categoriesRepo.setEmoji(id, body.emoji ?? null));
  });
}
export async function DELETE(request: Request, context: Context): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const id = idSchema.parse((await context.params).id);
    const { categoriesRepo } = await import("@/lib/db/categories-repo");
    await categoriesRepo.delete(id);
    return new Response(null, { status: 204 });
  });
}
```

Create `src/app/api/uploads/presign/route.ts`:

```ts
import { handleRoute, json, readJson, requireOwner } from "@/lib/api-route";
import { uploadSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return handleRoute(request, async () => {
    await requireOwner(request);
    const body = uploadSchema.parse(await readJson(request));
    const { presignUpload } = await import("@/lib/storage/s3");
    return json(await presignUpload(body));
  });
}
```

Create `src/app/api/share/[id]/route.ts`:

```ts
import { handleRoute, json } from "@/lib/api-route";
import { idSchema } from "@/lib/api-schemas";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleRoute(request, async () => {
    const id = idSchema.parse((await context.params).id);
    const { recipesRepo } = await import("@/lib/db/recipes-repo");
    const recipe = await recipesRepo.getById(id);
    const { title, coverImage, ingredients, instructions, notes, cookTime, prepTime, servings, calories, protein, carbs, fat } = recipe;
    return json({ id, title, coverImage, ingredients, instructions, notes, cookTime, prepTime, servings, calories, protein, carbs, fat });
  });
}
```

The public share response includes notes because the existing share page displays them. It deliberately excludes favorite status, category IDs, private photo keys, timestamps, tags, and future incidental repository attributes. It does not forward the entire recipe object. The shared wrapper makes it no-store as well.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/app/api/categories/route.test.ts src/app/api/uploads/presign/route.test.ts 'src/app/api/share/[id]/route.test.ts'
npx tsc --noEmit --incremental false
git add src/app/api/categories/route.ts 'src/app/api/categories/[id]/route.ts' src/app/api/categories/route.test.ts src/app/api/uploads/presign/route.ts src/app/api/uploads/presign/route.test.ts 'src/app/api/share/[id]/route.ts' 'src/app/api/share/[id]/route.test.ts'
git commit -m "feat: add guarded category upload and public share APIs"
```

Expected: all route tests pass; no credentials needed; typecheck passes. Pages continue to use Supabase until Phase 4.

---

### Task 6: Delegate only the new API paths to their handlers

**Files:**
- Create: `src/middleware.test.ts`
- Modify: `src/lib/route-access.ts`, `src/lib/route-access.test.ts`
- Test: those two test files; existing `src/middleware.ts` remains unchanged

**Interfaces:**
- Produces: unchanged signatures `isPublicPath(pathname: string): boolean`, `isBypassedPath(pathname: string): boolean` with narrow route patterns below.
- Consumes: existing `middleware(request: NextRequest): Promise<NextResponse>`; new route guards remain the authorization boundary even when a handler is invoked directly.

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/route-access.test.ts` in full (retain the existing public-page cases; the previous `/api/recipes` non-bypass assertion intentionally changes because the new handler now owns its auth):

```ts
import { describe, expect, it } from "vitest";
import { isBypassedPath, isPublicPath } from "@/lib/route-access";

describe("isPublicPath", () => {
  it("treats /login as public", () => expect(isPublicPath("/login")).toBe(true));
  it.each(["/", "/recipes", "/login/extra", "/api/recipes"])("keeps %s protected", (path) => expect(isPublicPath(path)).toBe(false));
});
describe("isBypassedPath", () => {
  it.each([
    "/api/auth", "/api/auth/login", "/api/auth/session", "/api/health",
    "/_next/static/chunk.js", "/_next/image?url=x", "/favicon.ico", "/robots.txt", "/sitemap.xml",
    "/api/recipes", "/api/recipes/id", "/api/recipes/id/favorite",
    "/api/categories", "/api/categories/id", "/api/uploads/presign", "/api/share/id",
  ])("delegates %s to its own handler", (path) => expect(isBypassedPath(path)).toBe(true));
  it.each([
    "/", "/recipes", "/api/chat", "/api/healthz", "/api/health/extra",
    "/robots.txt/extra", "/sitemap.xml/extra", "/api/auth-other", "/api/recipes-other",
    "/api/recipes/id/extra", "/api/categories/id/extra", "/api/uploads/presign/extra",
    "/api/share-other/id", "/api/share/id/extra",
  ])("does not bypass %s", (path) => expect(isBypassedPath(path)).toBe(false));
});
```

Create `src/middleware.test.ts`:

```ts
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth-session";
import { recipesRepo } from "@/lib/db/recipes-repo";
import { middleware } from "@/middleware";
import { GET, POST } from "@/app/api/recipes/route";

vi.mock("@/lib/db/recipes-repo", () => ({ recipesRepo: { list: vi.fn(), create: vi.fn() } }));
vi.mock("@/lib/api-rate-limit", () => ({ consumeApiLimit: () => ({ allowed: true, retryAfter: 0 }) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AUTH_SESSION_SECRET", "unit-test-session-secret"); });
afterEach(() => vi.unstubAllEnvs());
async function req(path: string, username?: string, method = "GET") {
  const token = username ? await createSessionToken(username) : "";
  return new NextRequest(`https://cookbook.example${path}`, { method,
    headers: { cookie: `${AUTH_COOKIE_NAME}=${token}`, origin: "https://cookbook.example", "content-type": "application/json" },
    body: method === "POST" ? "{}" : undefined });
}
it("lets the handler return JSON 401 instead of a login redirect", async () => {
  const request = await req("/api/recipes");
  expect((await middleware(request)).headers.get("x-middleware-next")).toBe("1");
  const response = await GET(request);
  expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "Unauthorized" });
  expect(response.headers.get("location")).toBeNull();
  expect(recipesRepo.list).not.toHaveBeenCalled();
});
it("keeps a recruiter write forbidden after middleware delegation", async () => {
  const request = await req("/api/recipes", "recruiter", "POST");
  expect((await middleware(request)).headers.get("x-middleware-next")).toBe("1");
  expect((await POST(request)).status).toBe(403);
  expect(recipesRepo.create).not.toHaveBeenCalled();
});
it("bypasses public share even with a malformed cookie", async () => {
  const request = new NextRequest("https://cookbook.example/api/share/id", { headers: { cookie: `${AUTH_COOKIE_NAME}=a.%%%` } });
  expect((await middleware(request)).headers.get("x-middleware-next")).toBe("1");
});
it("does not bypass a sibling API path", async () => {
  expect((await middleware(await req("/api/recipes-other"))).headers.get("location")).toBe("https://cookbook.example/login");
});
it("keeps private-page login redirects", async () => {
  expect((await middleware(await req("/recipes"))).headers.get("location")).toBe("https://cookbook.example/login");
});
it("keeps recruiter edit-page redirects", async () => {
  expect((await middleware(await req("/recipes/new", "recruiter"))).headers.get("location")).toBe("https://cookbook.example/");
});
it("keeps signed-in login-page redirects", async () => {
  expect((await middleware(await req("/login", "test"))).headers.get("location")).toBe("https://cookbook.example/");
});
it("keeps owner page access", async () => {
  expect((await middleware(await req("/recipes", "test"))).headers.get("x-middleware-next")).toBe("1");
});
```

- [ ] **Step 2: Prove RED**

```powershell
npx vitest run src/lib/route-access.test.ts src/middleware.test.ts
```

Expected: new bypass cases fail; `/api/recipes` still redirects before the handler under the old predicate. Existing page tests remain green.

- [ ] **Step 3: Replace the predicate module**

Replace `src/lib/route-access.ts` in full:

```ts
const PUBLIC_ROUTES = new Set(["/login"]);
const HANDLER_OWNED_API = /^\/api\/(?:recipes(?:\/[^/]+(?:\/favorite)?)?|categories(?:\/[^/]+)?|uploads\/presign|share\/[^/]+)\/?$/;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

export function isBypassedPath(pathname: string): boolean {
  return (
    pathname === "/api/auth" || pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" || HANDLER_OWNED_API.test(pathname) ||
    pathname.startsWith("/_next/") || pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" || pathname === "/sitemap.xml"
  );
}
```

This is delegation to route auth, not public access to protected data. Every protected handler has already been tested for anonymous/recruiter rejection. Share alone omits viewer authorization. No blanket `/api/` bypass, middleware rename, page redirect rewrite, or legacy route swap is introduced. The exact static path and `/api/auth` boundary cases also finish the small Phase 0 follow-ups.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/lib/route-access.test.ts src/middleware.test.ts
npx tsc --noEmit --incremental false
git add src/lib/route-access.ts src/lib/route-access.test.ts src/middleware.test.ts
git commit -m "feat: delegate new API paths to tested route authorization"
```

Expected: **35 route-access cases and 8 middleware cases** pass. Existing signed-in page behavior remains unchanged.

---

### Task 7: Local HTTP integration with the real table and bucket (human, guided)

**Files:**
- Create: none in the repository; temporary cookies/JSON/image under the OS temp directory only
- Modify: `docs/resume-highlights.md` (one new Phase 3 bullet)
- Test: local HTTP routes against existing AWS resources, using `curl.exe`; no production writes

**Interfaces:**
- Produces: verified create → presign → PUT → read → favorite → category cleanup → delete flow, public share, and anonymous/recruiter denial evidence.
- Consumes: Phase 3 HTTP contracts and `presignUpload(input): Promise<{ key: string; uploadUrl: string }>`, Phase 2 app credentials, Node 22 with `--env-file` solely for explicit orphan-object cleanup.

- [ ] **Step 1: Record the claim as planned and run local gates**

Append this bullet to `## Bullet points` in `docs/resume-highlights.md`; leave existing Phase 4/client-access and migration claims planned:

```markdown
- `planned` Added validated Next.js APIs over DynamoDB and S3 with cookie-based viewer/owner authorization, atomic category patches, same-origin write checks, bounded JSON bodies, explicit public-share responses, and mocked route tests; verified the authenticated create/upload/read/favorite/delete flow locally against existing AWS resources.
```

```powershell
npm test
npm run test:coverage -- --coverage.include="src/lib/api-*.ts" --coverage.include="src/lib/route-access.ts" --coverage.include="src/middleware.ts" --coverage.include="src/app/api/recipes/**/*.ts" --coverage.include="src/app/api/categories/**/*.ts" --coverage.include="src/app/api/uploads/**/*.ts" --coverage.include="src/app/api/share/**/*.ts" --coverage.include="src/lib/db/**/*.ts" --coverage.include="src/lib/storage/**/*.ts" --coverage.exclude="**/*.test.ts" --coverage.thresholds.perFile --coverage.thresholds.statements=80 --coverage.thresholds.branches=80 --coverage.thresholds.functions=80 --coverage.thresholds.lines=80
npm run lint
npm run build
git add docs/resume-highlights.md
git commit -m "docs: track Phase 3 API integration as planned"
```

Expected: durable suite and all per-file coverage thresholds pass; lint/build exit 0. Build must also pass in credential-free CI because no route imports AWS at module evaluation. If meaningful added cases change totals, update the final test count, not thresholds. The resume bullet remains `planned` until all live checks and cleanup succeed.

- [ ] **Step 2: Start the local dev server using the existing app credentials**

In Terminal 1, clear ambient AWS keys/session overrides so Next loads the Phase 2 app key from `.env.local`; the named profile is for CLI checks only. Confirm existing prerequisites before running the server. Use a free local port; every smoke URL and Origin below assumes 3100.

```powershell
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
$env:AWS_PROFILE = "cute-cookbook-project"; $env:AWS_REGION = "us-east-2"
npm run dev -- --port 3100
```

Expected: local server ready at `http://localhost:3100`; existing pages still use Supabase. Do not run against `cutecookbook.com`, change hosting secrets, create another app key, or start a Lightsail container.

- [ ] **Step 3: Run the complete curl session in Terminal 2**

Paste the following PowerShell as a single script block. It stores credentials/cookies only under a unique OS temp directory, uses actual login cookies, checks status codes instead of following redirects, and cleans only resources identified by this run's UUID. Enter the local **test owner** and **recruiter** passwords when prompted; do not echo them or paste them into the plan/PR. Do not enable curl verbose/trace logging.

```powershell
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
$base = "http://localhost:3100"
$runId = [guid]::NewGuid().ToString()
$smokeDir = Join-Path ([System.IO.Path]::GetTempPath()) "cute-cookbook-phase3-$runId"
$null = New-Item -ItemType Directory -Path $smokeDir -ErrorAction Stop
$ownerJar = Join-Path $smokeDir "owner.cookies"
$recruiterJar = Join-Path $smokeDir "recruiter.cookies"
$payloadPath = Join-Path $smokeDir "request.json"
$responsePath = Join-Path $smokeDir "response.json"
$imagePath = Join-Path $smokeDir "pixel.png"
$recipeTitle = "Phase 3 smoke $runId"
$categoryName = "Phase 3 smoke $runId"
$renamedCategory = "Phase 3 lunch $runId"
$recipeId = $null; $categoryId = $null; $coverKey = $null
$recipeCreateAttempted = $false; $categoryCreateAttempted = $false
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Invoke-SmokeApi {
  param([string]$Method, [string]$Path, [string]$Jar = "", $Body = $null, [int]$Expected = 200)
  $curlArgs = @('-sS', '-o', $responsePath, '-w', '%{http_code}', '-X', $Method, "$base$Path")
  if ($Jar) { $curlArgs += @('-b', $Jar, '-c', $Jar) }
  if ($Method -in @('POST', 'PATCH', 'DELETE')) { $curlArgs += @('-H', "Origin: $base") }
  if ($null -ne $Body) {
    [System.IO.File]::WriteAllText($payloadPath, ($Body | ConvertTo-Json -Depth 10 -Compress), $utf8)
    $curlArgs += @('-H', 'Content-Type: application/json', '--data-binary', "@$payloadPath")
  }
  $httpStatus = & curl.exe @curlArgs
  if ($LASTEXITCODE -ne 0) { throw "curl failed for $Method $Path" }
  if ([int]$httpStatus -ne $Expected) { throw "$Method $Path returned $httpStatus; expected $Expected" }
  if ($Expected -eq 204) { return }
  $responseText = Get-Content -LiteralPath $responsePath -Raw -ErrorAction Stop
  if ($responseText) { return ($responseText | ConvertFrom-Json) }
}

try {
  foreach ($login in @(@{ User = 'test'; Jar = $ownerJar }, @{ User = 'recruiter'; Jar = $recruiterJar })) {
    $securePassword = Read-Host "Local $($login.User) password" -AsSecureString
    $plainPassword = (New-Object System.Management.Automation.PSCredential($login.User, $securePassword)).GetNetworkCredential().Password
    Invoke-SmokeApi -Method POST -Path '/api/auth/login' -Jar $login.Jar -Body @{ username = $login.User; password = $plainPassword } | Out-Null
    Remove-Variable plainPassword, securePassword
  }
  $ownerSession = Invoke-SmokeApi -Method GET -Path '/api/auth/session' -Jar $ownerJar
  $recruiterSession = Invoke-SmokeApi -Method GET -Path '/api/auth/session' -Jar $recruiterJar
  if ($ownerSession.role -ne 'owner' -or $recruiterSession.role -ne 'recruiter') { throw 'Wrong smoke session roles' }
  Invoke-SmokeApi -Method GET -Path '/api/recipes' -Expected 401 | Out-Null
  Invoke-SmokeApi -Method POST -Path '/api/recipes' -Body @{} -Expected 401 | Out-Null

  $categoryCreateAttempted = $true
  $category = Invoke-SmokeApi -Method POST -Path '/api/categories' -Jar $ownerJar -Body @{ name = $categoryName; emoji = $null } -Expected 201
  $categoryId = $category.id
  $recipeBody = @{
    title = $recipeTitle; ingredients = @(); instructions = @(); notes = $null; sourceUrl = $null
    cookTime = $null; prepTime = $null; servings = $null; calories = $null; protein = $null; carbs = $null; fat = $null
    isFavorite = $false; categoryIds = @($categoryId); tags = @(); photos = @(); coverImage = $null
  }
  $recipeCreateAttempted = $true
  $recipe = Invoke-SmokeApi -Method POST -Path '/api/recipes' -Jar $ownerJar -Body $recipeBody -Expected 201
  $recipeId = $recipe.id
  if (-not $recipeId -or -not $categoryId) { throw 'Create response omitted an id' }

  [System.IO.File]::WriteAllBytes($imagePath, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII='))
  $signed = Invoke-SmokeApi -Method POST -Path '/api/uploads/presign' -Jar $ownerJar -Body @{ fileName = 'pixel.png'; contentType = 'image/png'; size = (Get-Item -LiteralPath $imagePath).Length }
  $coverKey = $signed.key
  $putStatus = & curl.exe -sS -o $responsePath -w '%{http_code}' -X PUT -H 'Content-Type: image/png' --upload-file $imagePath $signed.uploadUrl
  if ($LASTEXITCODE -ne 0 -or [int]$putStatus -ne 200) { throw 'Presigned S3 PUT failed' }
  Invoke-SmokeApi -Method PATCH -Path "/api/recipes/$recipeId" -Jar $ownerJar -Body @{ coverImage = $coverKey } | Out-Null
  $read = Invoke-SmokeApi -Method GET -Path "/api/recipes/$recipeId" -Jar $recruiterJar
  if ($read.coverImage -ne "https://d2gmo95al03pdi.cloudfront.net/$coverKey") { throw 'Cover URL was not resolved through the existing CDN' }
  $public = Invoke-SmokeApi -Method GET -Path "/api/share/$recipeId"
  if ($public.id -ne $recipeId -or $public.PSObject.Properties.Name -contains 'categoryIds') { throw 'Public share contract failed' }
  $cdnStatus = & curl.exe -sS -o $responsePath -w '%{http_code}' $read.coverImage
  if ($LASTEXITCODE -ne 0 -or [int]$cdnStatus -ne 200) { throw 'CloudFront image read failed' }

  Invoke-SmokeApi -Method POST -Path "/api/recipes/$recipeId/favorite" -Jar $ownerJar -Body @{ value = $true } | Out-Null
  $visible = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $favorites = @(Invoke-SmokeApi -Method GET -Path "/api/recipes?favorite=1&category=$categoryId" -Jar $ownerJar)
    if (@($favorites | Where-Object { $_.id -eq $recipeId }).Count -eq 1) { $visible = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $visible) { throw 'Favorite/category GSI result did not become visible in 20 polls' }
  Invoke-SmokeApi -Method PATCH -Path "/api/categories/$categoryId" -Jar $ownerJar -Body @{ name = $renamedCategory; emoji = 'L' } | Out-Null
  $renamed = Invoke-SmokeApi -Method GET -Path "/api/categories/$categoryId" -Jar $recruiterJar
  if ($renamed.name -ne $renamedCategory -or $renamed.emoji -ne 'L') { throw 'Combined category PATCH failed' }

  foreach ($write in @(
    @{ Method = 'POST'; Path = '/api/recipes'; Body = @{} },
    @{ Method = 'PATCH'; Path = "/api/recipes/$recipeId"; Body = @{ title = 'Forbidden' } },
    @{ Method = 'DELETE'; Path = "/api/recipes/$recipeId"; Body = $null },
    @{ Method = 'POST'; Path = "/api/recipes/$recipeId/favorite"; Body = @{ value = $false } },
    @{ Method = 'POST'; Path = '/api/categories'; Body = @{ name = 'Forbidden'; emoji = $null } },
    @{ Method = 'PATCH'; Path = "/api/categories/$categoryId"; Body = @{ emoji = 'X' } },
    @{ Method = 'DELETE'; Path = "/api/categories/$categoryId"; Body = $null },
    @{ Method = 'POST'; Path = '/api/uploads/presign'; Body = @{} }
  )) {
    Invoke-SmokeApi -Method $write.Method -Path $write.Path -Jar $recruiterJar -Body $write.Body -Expected 403 | Out-Null
  }
  Invoke-SmokeApi -Method DELETE -Path "/api/categories/$categoryId" -Jar $ownerJar -Expected 204
  $cleaned = Invoke-SmokeApi -Method GET -Path "/api/recipes/$recipeId" -Jar $ownerJar
  if ($cleaned.categoryIds -contains $categoryId) { throw 'Category reference cleanup failed' }
  Invoke-SmokeApi -Method DELETE -Path "/api/recipes/$recipeId" -Jar $ownerJar -Expected 204
  Invoke-SmokeApi -Method GET -Path "/api/recipes/$recipeId" -Jar $ownerJar -Expected 404 | Out-Null
  Invoke-SmokeApi -Method GET -Path "/api/share/$recipeId" -Expected 404 | Out-Null
  Write-Output "HTTP smoke passed for run $runId; cleanup follows"
} finally {
  $cleanupErrors = @()
  # Recover only this run's ids if a create response was lost.
  try {
    if ($recipeCreateAttempted -and -not $recipeId) {
      for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $ownedMatches = @(Invoke-SmokeApi -Method GET -Path '/api/recipes' -Jar $ownerJar | Where-Object { $_.title -eq $recipeTitle })
        if ($ownedMatches.Count -eq 1) { $recipeId = $ownedMatches[0].id; break }
        Start-Sleep -Seconds 1
      }
    }
    if ($recipeId) {
      $present = & curl.exe -sS -o $responsePath -w '%{http_code}' -b $ownerJar "$base/api/recipes/$recipeId"
      if ($LASTEXITCODE -ne 0) { throw "Cannot check smoke recipe $recipeId" }
      if ([int]$present -eq 200) { Invoke-SmokeApi -Method DELETE -Path "/api/recipes/$recipeId" -Jar $ownerJar -Expected 204 }
      elseif ([int]$present -ne 404) { throw "Cannot clean smoke recipe $recipeId" }
      Invoke-SmokeApi -Method GET -Path "/api/recipes/$recipeId" -Jar $ownerJar -Expected 404 | Out-Null
    }
  } catch { $cleanupErrors += $_.Exception.Message }
  try {
    if ($categoryCreateAttempted -and -not $categoryId) {
      for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $ownedMatches = @(Invoke-SmokeApi -Method GET -Path '/api/categories' -Jar $ownerJar | Where-Object { $_.name -in @($categoryName, $renamedCategory) })
        if ($ownedMatches.Count -eq 1) { $categoryId = $ownedMatches[0].id; break }
        Start-Sleep -Seconds 1
      }
    }
    if ($categoryId) {
      $present = & curl.exe -sS -o $responsePath -w '%{http_code}' -b $ownerJar "$base/api/categories/$categoryId"
      if ($LASTEXITCODE -ne 0) { throw "Cannot check smoke category $categoryId" }
      if ([int]$present -eq 200) { Invoke-SmokeApi -Method DELETE -Path "/api/categories/$categoryId" -Jar $ownerJar -Expected 204 }
      elseif ([int]$present -ne 404) { throw "Cannot clean smoke category $categoryId" }
      Invoke-SmokeApi -Method GET -Path "/api/categories/$categoryId" -Jar $ownerJar -Expected 404 | Out-Null
    }
  } catch { $cleanupErrors += $_.Exception.Message }
  try {
    if ($coverKey) {
      $env:PHASE3_SMOKE_KEY = $coverKey
      $s3Cleanup = @'
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
const key = process.env.PHASE3_SMOKE_KEY;
if (!key || !/^covers\/[0-9a-f-]{36}\.png$/.test(key)) throw new Error("Invalid smoke cover key");
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
if (!accessKeyId || !secretAccessKey) throw new Error("Missing app credentials");
const client = new S3Client({ region: "us-east-2", credentials: { accessKeyId, secretAccessKey } });
await client.send(new DeleteObjectCommand({ Bucket: "cutecookbookdata-imagesbucket1e86afb2-lnm24xf2wzzn", Key: key }));
console.log("Explicit smoke object cleanup passed");
'@
      $s3Cleanup | node --env-file=.env.local --input-type=module
      if ($LASTEXITCODE -ne 0) { throw "Object cleanup failed for $coverKey" }
    }
  } catch { $cleanupErrors += $_.Exception.Message }
  Remove-Item Env:PHASE3_SMOKE_KEY -ErrorAction SilentlyContinue
  Remove-Variable plainPassword, securePassword -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ownerJar, $recruiterJar, $payloadPath, $responsePath, $imagePath -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $smokeDir -ErrorAction SilentlyContinue
  if ($cleanupErrors.Count) { throw "Smoke cleanup incomplete for run ${runId}: $($cleanupErrors -join '; ')" }
}
```

Expected: no redirects for API errors; anonymous 401; all eight recruiter writes 403; owner/category/recipe/upload/share/favorite checks succeed; created recipe/category return 404 after deletion; direct S3 `DeleteObject` cleanup succeeds for the captured key. The explicit SDK cleanup handles an uploaded orphan even if attaching the cover failed; it does not rely on the repository's intentionally best-effort deletion. No bucket listing or broader deletion is used.

If a create request had an ambiguous network failure, the exact run title/name is polled for recovery. If recovery finds no item within its polling budget, do not claim conclusive cleanup: preserve the run UUID/title/name as non-secret recovery evidence and inspect only those exact items once connectivity returns. Any failed check or unresolved cleanup keeps the bullet planned and blocks phase completion. A CDN fetch may still serve cached bytes after object deletion; base-table 404 and successful explicit S3 deletion are the cleanup evidence, not immediate CDN/GSI disappearance.

- [ ] **Step 4: Mark only the verified Phase 3 claim done**

After the entire smoke and cleanup succeed, change only the newly added Phase 3 bullet's tag to `done`. Do not mark the browser-access replacement claim done: pages still call Supabase. Stop Terminal 1 with Ctrl+C, then:

```powershell
git status --short
git check-ignore .env.local
git ls-files -- .env.local
git add docs/resume-highlights.md
git commit -m "docs: record verified Phase 3 API smoke"
```

Expected: no secrets or smoke artifacts in the index; only the new Phase 3 claim becomes done. Existing infra/untracked work stays intact.

---

### Task 8: Final gates, review, and PR to master

**Files:**
- Create: none
- Modify: only Phase 3 files if review finds a defect; update expected counts in this plan if meaningful tests are added
- Test: all `src/**/*.test.ts`, scoped coverage, completed local HTTP smoke

**Interfaces:**
- Produces: reviewed `feat/aws-migration-phase-3` → `master` PR with test plan and passing checks.
- Consumes: all route signatures above; `gh pr create --base master`, `gh pr checks --watch`. No merge/deploy/cutover.

- [ ] **Step 1: Run durable gates and inspect scope**

```powershell
npm test
npm run test:coverage -- --coverage.include="src/lib/api-*.ts" --coverage.include="src/lib/route-access.ts" --coverage.include="src/middleware.ts" --coverage.include="src/app/api/recipes/**/*.ts" --coverage.include="src/app/api/categories/**/*.ts" --coverage.include="src/app/api/uploads/**/*.ts" --coverage.include="src/app/api/share/**/*.ts" --coverage.include="src/lib/db/**/*.ts" --coverage.include="src/lib/storage/**/*.ts" --coverage.exclude="**/*.test.ts" --coverage.thresholds.perFile --coverage.thresholds.statements=80 --coverage.thresholds.branches=80 --coverage.thresholds.functions=80 --coverage.thresholds.lines=80
npm run lint
npm run build
npm audit
git diff --check
git diff --stat feat/aws-migration-phase-2...HEAD
git status --short
```

Expected: **19 files / 241 tests**, based on 110 existing plus 131 new cases, including four appended category tests and the expanded route-access cases. If the baseline or review adds cases, record the actual higher count in PR/exit evidence. Every scoped file reaches all four 80% thresholds; lint/build pass; audit findings reviewed without unrelated dependency-upgrade scope. No AWS credentials in CI/build args or client bundles. Do not claim pre-existing audit findings are fixed without evidence.

- [ ] **Step 2: Review auth/validation and the existing AWS state**

Use code-reviewer and security-reviewer agents on the Phase 3 diff; fix critical/high findings and rerun affected gates. Verify every new mutation guards before reading a body/importing AWS, exact API path boundaries, no role/ID injection, one atomic category PATCH, bounded streams, safe public projection, no-store errors/success, and generic 500. Inspect the full diff against Phase 2 and then `master`; do not stage pending infra or `.superpowers/`. Confirm inherited Region work is committed through its own phase before readiness.

```powershell
$env:AWS_PROFILE = "cute-cookbook-project"; $env:AWS_REGION = "us-east-2"
aws lightsail get-container-services --region us-east-2 --query "containerServices[].containerServiceName"
aws iam list-access-keys --user-name cute-cookbook-deploy --query "length(AccessKeyMetadata)" --output text
git check-ignore .env.local
git ls-files -- .env.local
gh run list --workflow "Vercel Deploy" --branch master --limit 1
```

Expected: `[]`, `0`, ignored env path, no tracked env path. Existing Vercel production remains unchanged; signed-in recipe/favorites/category pages still use the existing Supabase behavior. Do not perform write smoke against production.

- [ ] **Step 3: Commit the new plan if untracked, push, open PR, and watch**

Include this new plan in its own docs commit if it is not already tracked; the Phase 2 plan is already tracked through its own phase. Do not edit older plans. Fixes to implementation files use their explicit paths and conventional messages. If Phase 2 is not merged yet, identify the stacked dependency in the PR and recheck the diff after it lands.

```powershell
git add docs/plans/2026-10-24-aws-migration-phase-3-api-routes.md
git commit -m "docs: add Phase 3 API implementation plan"
git diff --stat master...HEAD
git log --oneline master..HEAD
git push -u origin feat/aws-migration-phase-3
Set-Content -Path $env:TEMP\cute-cookbook-phase-3-pr.md -Value @"
## Phase 3: API routes

- Adds strict Zod request contracts and guarded recipe/category/favorite/upload endpoints over the Phase 2 data layer.
- Enforces viewer reads and owner writes, same-origin mutations, bounded JSON, no-store responses, generic internal errors, and a separate process-local API rate budget.
- Adds a public share GET with an explicit projection and narrow middleware delegation so API errors are JSON rather than page redirects.
- Makes combined category name/emoji patches atomic within the existing uniqueness transaction.
- Lazily imports AWS modules after authorization/validation so existing credential-free builds remain supported.
- Keeps pages, chat, API client migration, Supabase removal, infra, DNS, certificates, and container deployment out of scope.
- Uses existing us-east-2 resources in project 592685885054; Vercel + Supabase production remains in place.

## Test plan

- npm test: 19 files / 241 tests (update if meaningful review cases change the count).
- Scoped per-file statements/branches/functions/lines each at least 80%, including new routes/helpers and existing db/storage.
- npm run lint and npm run build pass; npm audit reviewed.
- Direct handler and middleware boundary tests verify JSON 401, all recruiter write 403s, validation, typed errors, safe share output, and POST body preservation.
- Human local curl flow against existing AWS resources verified create, category patch, presign, S3 PUT, CDN/read/share, favorite filters, reference cleanup, delete, and cleanup evidence.
- .env.local ignored/untracked; temporary secrets and uploads cleaned; no Lightsail container or deploy-user key created.

Dependency: based on feat/aws-migration-phase-2; inherited earlier-phase Region work must be retained. This PR does not perform a production cutover.
"@
gh pr create --base master --head feat/aws-migration-phase-3 --title "Phase 3: guarded AWS API routes" --body-file $env:TEMP\cute-cookbook-phase-3-pr.md
gh pr checks --watch
```

Expected: PR targets `master`; CI quality/infra and Vercel preview checks pass. A clean already-tracked plan needs no duplicate docs commit; skip that commit when `git diff --cached --quiet` indicates nothing staged. If checks fail, fix only the allowed files, rerun, push, and watch again. Attach the created PR to the Codex chat with the app's PR attachment tool when available. Do not merge or deploy as part of this plan.

---

## Phase 3 exit checklist

- [ ] Phase 3 inherits the completed Phase 2 data layer and the intended Region history; pending unrelated infra, `.superpowers/`, and older plan work were preserved.
- [ ] `npm test` → **19 files / 241 tests** or documented updated counts after review; all pass locally and in CI.
- [ ] All four coverage measures are ≥80% per scoped new helper/route and existing db/storage module; lint/build pass; audit reviewed.
- [ ] Every route in the design table exists with async params where required; no migration ID/timestamp overrides are accepted from HTTP input.
- [ ] Anonymous protected reads/writes return JSON 401; recruiter reads work and all eight mutation handlers return 403 before repository/presign access; both owner accounts retain access.
- [ ] Malformed cookies are 401; missing production session config and unexpected AWS failures remain logged generic 500; a guard does not consume a POST body.
- [ ] Request schemas are strict, JSON bodies have an actual 256 KiB byte limit, mutation Origin is checked, and no permissive CORS was added.
- [ ] API rate limiting is separate from login attempts and its per-process/shared-budget limitation is documented; 429 includes Retry-After.
- [ ] Combined category name/emoji PATCH is atomic; case-only renames still avoid duplicate uniqueness actions; deletion removes recipe references.
- [ ] Public share GET exposes only the explicit fields, including existing public notes, and all new responses use no-store.
- [ ] Actual middleware tests prove protected API errors reach handlers without login redirects, public share bypass is narrow, and existing signed-in page redirects/access are preserved.
- [ ] Human local curl flow passed create → presign → upload → read → favorite → delete, plus category CRUD, public share, and denied-write checks; only that run's items/object were cleaned and temporary secrets removed.
- [ ] `.env.local` remains ignored/untracked, the app key was reused, deploy user has zero keys, and Lightsail container list is `[]`; no resource/certificate/DNS/deploy changes occurred.
- [ ] New Phase 3 resume bullet is done only after successful live verification; the Phase 4 browser-access replacement claim remains planned.
- [ ] PR to `master` has green checks; production remains on Vercel + Supabase, with pages/chat still using their current data access.

Next: Phase 4 plan (typed API client, page/chat data-call swaps, image-host configuration, and removal of app-side Supabase usage).
