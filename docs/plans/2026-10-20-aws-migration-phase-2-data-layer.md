# AWS Migration — Phase 2: Data layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1–4 are code and are subagent-executable, in order. Task 5 creates the app access key and runs a temporary integration script against the user's existing AWS resources; it is a guided manual task for the human. Task 6 opens the implementation PR.

**Goal:** Build and test the DynamoDB repositories and S3 helpers against the existing resources in `us-east-2`, reach 80%+ coverage on the new database/storage modules, and prove a create/list/delete round-trip against the real table without changing signed-in behavior.

**Architecture:** New server-side modules use AWS SDK v3's DynamoDB DocumentClient and S3 client. Recipes denormalize ingredients, instructions, category IDs, tags, and photos into one item. Lists query `GSI1` through every page, then apply optional filters in the repository. Category names use transactional uniqueness items. Stored image keys remain keys on writes and become CloudFront URLs on reads. Existing pages, routes, auth, and Supabase imports do not consume these modules yet.

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript 5, Node 22+, existing Vitest 5 + `@vitest/coverage-v8`, AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), `aws-sdk-client-mock`, AWS CLI v2, GitHub CLI.

**Spec:** `docs/plans/2026-10-18-aws-migration-design.md` §1 (item shapes/access patterns), §2 (keys, presign, best-effort delete, URL resolution), §3 (only Phase 2 modules), §7 (typed errors/config), §8 (repository/presign tests). The live facts below override stale Region/certificate instructions in earlier documents. Value types follow the current recipe detail/new/edit pages and category pages: ingredient amount/unit are strings, numeric recipe values and emoji are nullable, and AWS field names follow the design's camelCase table.
**Roadmap:** `docs/plans/2026-10-18-aws-migration-roadmap.md` — Phase 2 only.

## Global Constraints

- Production stays on Vercel + Supabase. Do not import these new modules into existing pages, handlers, middleware, or components in this phase. Existing signed-in behavior must stay unchanged.
- Project `592685885054`, selected Region `us-east-2`, CLI profile `cute-cookbook-project`. Confirm the selected Region in AWS Settings > View all projects > Overview > Additional Info > Region (or `~/.aws/config`). All regional commands below explicitly use `us-east-2`.
- `CuteCookbookData` is already `CREATE_COMPLETE`. It imported the existing empty `cute-cookbook` table: string `PK`/`SK`, `GSI1` on string `GSI1PK`/`GSI1SK`, projection ALL, on-demand, PITR. Use it; do not recreate it or deploy CDK.
- Existing bucket: `cutecookbookdata-imagesbucket1e86afb2-lnm24xf2wzzn`. `IMAGE_CDN_HOST=d2gmo95al03pdi.cloudfront.net`. The distribution has no custom domain. Use that hostname until `img.cutecookbook.com` actually exists.
- `CuteCookbookCertificates` is not deployed. CloudFormation in `us-east-1` is denied. No certificate, DNS, CDK deploy, Lightsail container, or new AWS resource is part of this phase. The only IAM change is the explicitly required app-user access key in Task 5; the container must remain uncreated.
- Both IAM users already exist with no access keys. Create a key only for `cute-cookbook-app`, as a human task; keep it in gitignored `.env.local`. `cute-cookbook-deploy` gets no key until Phase 6. Never print credentials, stage `.env.local`, or put keys in PR text.
- Out of scope: `src/lib/api-client.ts`, `src/lib/api-route.ts`, zod route handlers, page swaps, image-host changes in `next.config.ts`, and removing Supabase (Phases 3/4); migration script and cutover runbook (Phase 5); deployment/cutover (Phase 6).
- Only the listed Phase 2 modules, colocated tests, root dependency manifests, a temporary smoke script, and the Phase 2 resume bullet are implementation work. Keep the existing `vitest.config.mts` and `@/` alias. Do not add another runner, matcher package, SDK v2, `tsx`, or `pg`.
- All tests mock AWS calls; they use no real credentials or network. Target at least 80% each for statements, branches, functions, and lines on **each** new `src/lib/db` and `src/lib/storage` module. Apply coverage flags at invocation, without changing the existing runner config.
- Follow [DynamoDB pagination](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html): forward every nonempty `LastEvaluatedKey` as `ExclusiveStartKey`, including after empty pages. GSI reads are eventually consistent. Never use `Scan` or request strong consistency on a GSI.
- Follow [transaction constraints](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html): no two transaction actions target the same item. Map only conditional failures to typed domain errors; propagate other AWS failures. Category deletion's recipe cleanup follows the atomic category/uniqueness deletion and fails loudly if it cannot finish; it is not an atomic multi-recipe operation.
- Persist domain fields and the design's keys only. Preserve the original recipe ID/timestamps through optional migration overrides. Do not write public CDN URLs back during unrelated updates. Gallery API work is deferred; `photos/<recipeId>/<uuid>.<ext>` is reserved.
- Shell examples are PowerShell, run from the repository root unless stated. Use `;` between commands. Check each native command's exit code before continuing; PowerShell does not automatically stop at a nonzero exit. Stage paths explicitly. Conventional commits use `feat:`, `test:`, `chore:`, `docs:`.

## Prerequisites

- [ ] **Inspect and preserve Phase 1 Region work before branching.** At plan-writing time the branch is `feat/aws-migration-phase-1` with modified infra files and two untracked image-certificate files. Inspect first:

```powershell
git status --short
git branch --show-current
git diff -- infra/bin/app.ts infra/cdk.json infra/lib/certificates-stack.ts infra/lib/config.ts infra/lib/data-stack.ts infra/test/certificates-stack.test.ts infra/test/compute-stack.test.ts infra/test/config.test.ts infra/test/data-stack.test.ts
Get-Content -LiteralPath infra/lib/image-certificate-stack.ts
Get-Content -LiteralPath infra/test/image-certificate-stack.test.ts
```

Expected: identify the uncommitted `us-east-2` work on `feat/aws-migration-phase-1`, including the two untracked files. Do not reset, revert, stash away, or overwrite this work. If it remains uncommitted, create Phase 2 directly from the current Phase 1 checkout so the working changes travel with it. If committed before execution, start from the latest Phase 1 commit. Do not create Phase 2 from `master`.

```powershell
git switch feat/aws-migration-phase-1
git switch -c feat/aws-migration-phase-2
git status --short
git log -1 --oneline feat/aws-migration-phase-1
```

Expected: current branch becomes `feat/aws-migration-phase-2`, based on Phase 1, with the same pending infra changes if they were still uncommitted. Their review/commit belongs to the Phase 1 work; do not include them in the Phase 2 task commits. Before the final PR, ensure the completed Region changes are in Phase 1's history and present in this branch; otherwise keep the PR blocked rather than silently omitting them.

- [ ] **Read the dependency manifests and verify the baseline.** Root `package.json` currently has no AWS packages; Vitest and coverage are already installed. `infra/` dependencies do not satisfy root imports.

```powershell
Get-Content package.json
Get-Content vitest.config.mts
node --version
npm test
```

Expected: Node 22+; existing `@/` alias and `src/**/*.test.ts`; baseline **3 files / 37 tests** pass (16 auth-role, 19 route-access, 2 health). If the baseline has changed, record the actual baseline and add the new-test count stated in Task 6.

- [ ] **Verify the existing project and data stack using read-only CLI calls.** Clear unrelated static credential/session overrides first so this uses the intended CLI profile; do not display their values.

```powershell
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
$env:AWS_PROFILE = "cute-cookbook-project"; $env:AWS_REGION = "us-east-2"
aws sts get-caller-identity --query Account --output text
aws freetier get-account-plan-state --region us-east-2
aws cloudformation describe-stacks --stack-name CuteCookbookData --region us-east-2 --query "Stacks[0].{Status:StackStatus,Outputs:Outputs}"
aws dynamodb describe-table --table-name cute-cookbook --region us-east-2 --query "Table.{Name:TableName,Keys:KeySchema,Indexes:GlobalSecondaryIndexes[].IndexName,Billing:BillingModeSummary.BillingMode}"
```

Expected: project `592685885054`; record paid-plan status in AWS Settings > Billing if the plan-state call is unavailable; data stack `CREATE_COMPLETE`, outputs match the table/bucket/CDN above, PK/SK and GSI1 exist, billing is `PAY_PER_REQUEST`. A mismatch blocks the live smoke task, not mocked development. No bootstrap, table creation, certificate deployment, or resource provisioning is a remedy in this phase.

- [ ] **Verify secret isolation, no container, and GitHub access.**

```powershell
git check-ignore .env.local
git ls-files -- .env.local
aws iam list-access-keys --user-name cute-cookbook-app --query "AccessKeyMetadata[].AccessKeyId"
aws iam list-access-keys --user-name cute-cookbook-deploy --query "AccessKeyMetadata[].AccessKeyId"
aws lightsail get-container-services --region us-east-2 --query "containerServices[].containerServiceName"
gh auth status
```

Expected: `.env.local` is ignored and not tracked; both key lists and container list are `[]`; GitHub authentication succeeds. If an app key was created while this plan waited, reuse the existing locally stored key rather than creating another. Do not change the deploy user. If previously working AWS calls suddenly return Access Denied, check spend-limit status in AWS Settings > Billing before diagnosing application code.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `package.json`, `package-lock.json` | Modify | Add only missing root AWS v3 packages and `aws-sdk-client-mock` |
| `src/lib/types.ts` | Create | Domain shapes and repository inputs, matching current value types/design fields |
| `src/lib/types.test.ts` | Create | Compile-time shape checks in existing Vitest runner |
| `src/lib/config.ts`, `src/lib/config.test.ts` | Create | Production required-env validation and safe dev configuration |
| `src/lib/db/client.ts`, `src/lib/db/client.test.ts` | Create | Shared DocumentClient, explicit Region/credentials, undefined omission |
| `src/lib/db/keys.ts`, `src/lib/db/keys.test.ts` | Create | PK/SK and GSI builders |
| `src/lib/db/errors.ts`, `src/lib/db/errors.test.ts` | Create | `NotFoundError`, `ConflictError` |
| `src/lib/storage/s3.ts`, `src/lib/storage/s3.test.ts` | Create | Presign validation, MIME-derived cover keys, URL resolution, logged best-effort deletion |
| `src/lib/db/recipes-repo.ts`, `src/lib/db/recipes-repo.test.ts` | Create | Recipe CRUD, migration overrides, favorite/filter/pagination, image cleanup |
| `src/lib/db/categories-repo.ts`, `src/lib/db/categories-repo.test.ts` | Create | Category CRUD, transactional name locks, reference cleanup |
| `.env.local` | Modify locally only | App-user key and six AWS configuration values; never staged |
| `scripts/phase-2-smoke.ts`, `src/lib/db/phase-2-smoke.test.ts` | Create temporarily, then remove | Real-table create/list/delete through repository code; tests its cleanup and deletes only its own item |
| `docs/resume-highlights.md` | Modify | One Phase 2 bullet, `planned` until the real-table script succeeds |

---

### Task 1: Dependencies, types, config, keys, errors, and DocumentClient

**Files:**
- Create: `src/lib/types.ts`, `src/lib/config.ts`, `src/lib/db/client.ts`, `src/lib/db/keys.ts`, `src/lib/db/errors.ts`
- Modify: `package.json`, `package-lock.json`
- Test: `src/lib/types.test.ts`, `src/lib/config.test.ts`, `src/lib/db/client.test.ts`, `src/lib/db/keys.test.ts`, `src/lib/db/errors.test.ts`

**Interfaces:**
- Produces: `Recipe`, `RecipeSummary`, `Category`, `Ingredient`, `InstructionStep`, `RecipePhoto`, `CreateRecipeInput`, `RecipePatch`, `RecipeOverrides`, `CreateCategoryInput` (full definitions below).
- Produces: `readConfig(env?: Record<string, string | undefined>): AppConfig`, `config: AppConfig`, `db: DynamoDBDocumentClient`, `tableName: string`.
- Produces: `recipeKey(id: string): TableKey`, `recipeIndex(id: string, createdAt: string): IndexKey`, `categoryKey(id: string): TableKey`, `categoryIndex(name: string): IndexKey`, `categoryNameKey(name: string): TableKey`; `new NotFoundError(message?: string)`, `new ConflictError(message?: string)`.
- Consumes: six runtime env variables, existing Vitest setup; no app caller yet.

- [ ] **Step 1: Install only missing dependencies**

Read root `package.json` again if another task changed it. Install each package below only if absent; all five are absent at plan-writing time. Preserve other dependencies and scripts.

```powershell
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install --save-dev aws-sdk-client-mock
```

Expected: four new runtime packages and one new dev package; lockfile updated. No extra test runner, mock matchers, or migration tooling.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/types.test.ts`:

```ts
import { expectTypeOf, it } from "vitest";
import type { Category, Ingredient, InstructionStep, Recipe, RecipePhoto, RecipeSummary } from "@/lib/types";

it("keeps the existing value types with the design's field names", () => {
  expectTypeOf<Ingredient>().toEqualTypeOf<{ name: string; amount: string; unit: string }>();
  expectTypeOf<InstructionStep>().toEqualTypeOf<{ stepNumber: number; text: string }>();
  expectTypeOf<RecipePhoto>().toEqualTypeOf<{ key: string; sortOrder: number }>();
  expectTypeOf<Category>().toEqualTypeOf<{ id: string; name: string; emoji: string | null; createdAt: string }>();
  expectTypeOf<Recipe["cookTime"]>().toEqualTypeOf<number | null>();
  expectTypeOf<Recipe["coverImage"]>().toEqualTypeOf<string | null>();
  expectTypeOf<RecipeSummary>().toEqualTypeOf<Pick<Recipe,
    "id" | "title" | "coverImage" | "isFavorite" | "categoryIds" | "createdAt"
  >>();
});
```

Create `src/lib/config.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const complete = {
  NODE_ENV: "production", AWS_REGION: "us-east-2", TABLE_NAME: "cute-cookbook",
  BUCKET_NAME: "test-images", IMAGE_CDN_HOST: "d2gmo95al03pdi.cloudfront.net",
  AWS_ACCESS_KEY_ID: "test-key", AWS_SECRET_ACCESS_KEY: "test-secret",
};
beforeEach(() => {
  for (const key of ["AWS_REGION", "TABLE_NAME", "BUCKET_NAME", "IMAGE_CDN_HOST", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
    vi.stubEnv(key, "");
  }
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function load() {
  vi.stubEnv("NODE_ENV", "test");
  return import("@/lib/config");
}

describe("readConfig", () => {
  it.each([
    "AWS_REGION", "TABLE_NAME", "BUCKET_NAME", "IMAGE_CDN_HOST",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
  ])("rejects a missing production %s", async (field) => {
    const { readConfig } = await load();
    expect(() => readConfig({ ...complete, [field]: " " })).toThrow(field);
  });

  it("reads all six values without exposing credential values in errors", async () => {
    const { readConfig } = await load();
    expect(readConfig(complete)).toEqual({
      region: "us-east-2", tableName: "cute-cookbook", bucketName: "test-images",
      imageCdnHost: "d2gmo95al03pdi.cloudfront.net",
      credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
    });
    expect(() => readConfig({ ...complete, TABLE_NAME: "" })).toThrow("TABLE_NAME");
  });

  it("allows tests to load without real keys", async () => {
    const { readConfig } = await load();
    expect(readConfig({ NODE_ENV: "test" }).credentials).toBeUndefined();
    expect(readConfig({ NODE_ENV: "test" }).region).toBe("us-east-2");
  });

  it("rejects half a credential pair in development", async () => {
    const { readConfig } = await load();
    expect(() => readConfig({ NODE_ENV: "development", AWS_ACCESS_KEY_ID: "test" }))
      .toThrow("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
  });

  it("fails at module initialization in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TABLE_NAME", "");
    await expect(import("@/lib/config")).rejects.toThrow("TABLE_NAME");
  });
});
```

Create `src/lib/db/keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { categoryIndex, categoryKey, categoryNameKey, recipeIndex, recipeKey } from "@/lib/db/keys";

describe("keys", () => {
  it("builds recipe primary keys", () => {
    expect(recipeKey("r1")).toEqual({ PK: "RECIPE#r1", SK: "RECIPE" });
  });
  it("orders recipes by creation time and then id", () => {
    expect(recipeIndex("r1", "2026-10-20T10:00:00.000Z")).toEqual({
      GSI1PK: "RECIPE", GSI1SK: "2026-10-20T10:00:00.000Z#r1",
    });
  });
  it("builds category primary and alphabetical index keys", () => {
    expect(categoryKey("c1")).toEqual({ PK: "CATEGORY#c1", SK: "CATEGORY" });
    expect(categoryIndex("Dinner")).toEqual({ GSI1PK: "CATEGORY", GSI1SK: "dinner" });
  });
  it("uses a separate case-insensitive uniqueness key", () => {
    expect(categoryNameKey("Dinner")).toEqual({ PK: "CATEGORYNAME#dinner", SK: "CATEGORYNAME" });
  });
});
```

Create `src/lib/db/errors.test.ts`:

```ts
import { expect, it } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/db/errors";

it("creates a typed missing-item error", () => {
  const error = new NotFoundError("Recipe not found");
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe("NotFoundError");
  expect(error.message).toBe("Recipe not found");
  expect(new NotFoundError().message).toBe("Not found");
});
it("creates a typed conflict error", () => {
  expect(new ConflictError()).toBeInstanceOf(Error);
  expect(new ConflictError().name).toBe("ConflictError");
  expect(new ConflictError().message).toBe("Conflict");
});
```

Create `src/lib/db/client.test.ts`:

```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({ config: {
  region: "us-east-2", tableName: "test-table",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
} }));

it("creates one document client with undefined omission and explicit config", async () => {
  const spy = vi.spyOn(DynamoDBDocumentClient, "from");
  const { db, tableName } = await import("@/lib/db/client");
  expect(tableName).toBe("test-table");
  expect(db).toBeInstanceOf(DynamoDBDocumentClient);
  expect(spy).toHaveBeenCalledWith(expect.any(DynamoDBClient), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const base = spy.mock.calls[0][0];
  expect(await base.config.region()).toBe("us-east-2");
  expect(await base.config.credentials()).toMatchObject({ accessKeyId: "test" });
  spy.mockRestore();
});
```

- [ ] **Step 3: Run them to verify they fail**

```powershell
npx vitest run src/lib/config.test.ts src/lib/db/keys.test.ts src/lib/db/errors.test.ts src/lib/db/client.test.ts
npx tsc --noEmit --incremental false
```

Expected: runtime tests fail because the new modules do not exist; TypeScript fails on missing `@/lib/types`. Type-only imports are erased by Vitest, so `tsc` supplies the RED check for the types test.

- [ ] **Step 4: Create the modules**

Create `src/lib/types.ts`:

```ts
export type Ingredient = { name: string; amount: string; unit: string };
export type InstructionStep = { stepNumber: number; text: string };
export type RecipePhoto = { key: string; sortOrder: number };

export type Recipe = {
  id: string;
  title: string;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  notes: string | null;
  sourceUrl: string | null;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isFavorite: boolean;
  categoryIds: string[];
  tags: string[];
  photos: RecipePhoto[];
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeSummary = Pick<Recipe,
  "id" | "title" | "coverImage" | "isFavorite" | "categoryIds" | "createdAt"
>;
export type Category = { id: string; name: string; emoji: string | null; createdAt: string };
export type CreateRecipeInput = Omit<Recipe, "id" | "createdAt" | "updatedAt">;
export type RecipePatch = Partial<CreateRecipeInput>;
export type RecipeOverrides = Partial<Pick<Recipe, "id" | "createdAt" | "updatedAt">>;
export type CreateCategoryInput = Pick<Category, "name" | "emoji">;
```

`Recipe` is also the stored domain shape; only its boundary projection resolves `coverImage`. `RecipePhoto.key` stays a key. No category `updatedAt`, photo ID, expanded categories, or nutrition wrapper is introduced.

Create `src/lib/config.ts`:

```ts
export type AppConfig = {
  region: string;
  tableName: string;
  bucketName: string;
  imageCdnHost: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
};

const required = [
  "AWS_REGION", "TABLE_NAME", "BUCKET_NAME", "IMAGE_CDN_HOST",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
] as const;

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const missing = required.filter((key) => !env[key]?.trim());
  if (env.NODE_ENV === "production" && missing.length) {
    throw new Error(`Missing AWS configuration: ${missing.join(", ")}`);
  }
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
  }
  return {
    region: env.AWS_REGION?.trim() || "us-east-2",
    tableName: env.TABLE_NAME?.trim() || "cute-cookbook",
    bucketName: env.BUCKET_NAME?.trim() || "cutecookbookdata-imagesbucket1e86afb2-lnm24xf2wzzn",
    imageCdnHost: env.IMAGE_CDN_HOST?.trim() || "d2gmo95al03pdi.cloudfront.net",
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  };
}

export const config = readConfig();
```

Production fails on import if any required value is blank; errors list names only. Development can use the default SDK chain if no pair is supplied. Task 5 explicitly supplies the app pair, so the repository smoke cannot accidentally use the administrative profile. Existing production routes do not import this module yet.

Create `src/lib/db/keys.ts`:

```ts
export type TableKey = { PK: string; SK: string };
export type IndexKey = { GSI1PK: string; GSI1SK: string };

export function recipeKey(id: string): TableKey {
  return { PK: `RECIPE#${id}`, SK: "RECIPE" };
}
export function recipeIndex(id: string, createdAt: string): IndexKey {
  return { GSI1PK: "RECIPE", GSI1SK: `${createdAt}#${id}` };
}
export function categoryKey(id: string): TableKey {
  return { PK: `CATEGORY#${id}`, SK: "CATEGORY" };
}
export function categoryIndex(name: string): IndexKey {
  return { GSI1PK: "CATEGORY", GSI1SK: name.toLowerCase() };
}
export function categoryNameKey(name: string): TableKey {
  return { PK: `CATEGORYNAME#${name.toLowerCase()}`, SK: "CATEGORYNAME" };
}
```

Create `src/lib/db/errors.ts`:

```ts
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}
```

Create `src/lib/db/client.ts`:

```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "@/lib/config";

const client = new DynamoDBClient({ region: config.region, credentials: config.credentials });
export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
export const tableName = config.tableName;
```

The [DocumentClient guide](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-dynamodb-doc-client.html) requires explicit `removeUndefinedValues` for omission in v3. Tests inspect SDK configuration but application code does not mutate it.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
npx vitest run src/lib/types.test.ts src/lib/config.test.ts src/lib/db/keys.test.ts src/lib/db/errors.test.ts src/lib/db/client.test.ts
npx tsc --noEmit --incremental false
git add package.json package-lock.json src/lib/types.ts src/lib/types.test.ts src/lib/config.ts src/lib/config.test.ts src/lib/db/client.ts src/lib/db/client.test.ts src/lib/db/keys.ts src/lib/db/keys.test.ts src/lib/db/errors.ts src/lib/db/errors.test.ts
git commit -m "feat: add AWS data types configuration and database primitives"
```

Expected: **5 files / 18 tests** pass, typecheck exits 0, only these explicit paths enter the commit. Leave pending infra changes intact.

---

### Task 2: S3 presign, URL resolution, and best-effort cleanup

**Files:**
- Create: `src/lib/storage/s3.ts`
- Modify: none
- Test: `src/lib/storage/s3.test.ts`

**Interfaces:**
- Produces: `presignUpload(input: { fileName: string; contentType: string; size: number }): Promise<{ key: string; uploadUrl: string }>`, `toPublicUrl(keyOrUrl: string): string`, `deleteObject(key: string): Promise<void>`.
- Consumes: `config: AppConfig`; `getSignedUrl(client, command, { expiresIn: 300 })`. Recipes consume both URL resolution and deletion. Phase 3 consumes presign; no upload endpoint is created here.

- [ ] **Step 1: Write the failing test**

Create `src/lib/storage/s3.test.ts`:

```ts
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteObject, presignUpload, toPublicUrl } from "@/lib/storage/s3";

vi.mock("@/lib/config", () => ({ config: {
  region: "us-east-2", bucketName: "test-images", imageCdnHost: "d2gmo95al03pdi.cloudfront.net",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
} }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
const s3 = mockClient(S3Client);
beforeEach(() => {
  s3.reset();
  vi.mocked(getSignedUrl).mockReset().mockResolvedValue("https://signed.example/put");
});
afterEach(() => vi.restoreAllMocks());

describe("presignUpload", () => {
  it.each([
    ["image/jpeg", "jpg"], ["image/png", "png"],
    ["image/webp", "webp"], ["image/heic", "heic"],
  ])("signs %s with a MIME-derived extension", async (contentType, ext) => {
    const result = await presignUpload({ fileName: "untrusted.exe", contentType, size: 123 });
    expect(result.key).toMatch(new RegExp(`^covers/[0-9a-f-]{36}\\.${ext}$`));
    expect(result.uploadUrl).toBe("https://signed.example/put");
    const [client, command, options] = vi.mocked(getSignedUrl).mock.calls[0];
    expect(client).toBeInstanceOf(S3Client);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toEqual({
      Bucket: "test-images", Key: result.key, ContentType: contentType, ContentLength: 123,
    });
    expect(options).toEqual({ expiresIn: 300 });
  });
  it.each(["image/gif", "text/plain", "IMAGE/JPEG"])("rejects %s before signing", async (contentType) => {
    await expect(presignUpload({ fileName: "x", contentType, size: 1 })).rejects.toThrow("content type");
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it.each([0, -1, 0.5, NaN, Infinity, 10 * 1024 * 1024 + 1])("rejects size %s", async (size) => {
    await expect(presignUpload({ fileName: "x", contentType: "image/png", size })).rejects.toThrow("size");
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
  it("rejects an empty file name", async () => {
    await expect(presignUpload({ fileName: " ", contentType: "image/png", size: 1 })).rejects.toThrow("file name");
  });
  it("accepts exactly 10 MiB", async () => {
    await expect(presignUpload({ fileName: "x", contentType: "image/png", size: 10 * 1024 * 1024 }))
      .resolves.toHaveProperty("key");
  });
});

describe("toPublicUrl", () => {
  it.each([
    ["covers/a.png", "https://d2gmo95al03pdi.cloudfront.net/covers/a.png"],
    ["https://blog.example/photo.jpg", "https://blog.example/photo.jpg"],
  ])("resolves %s", (input, expected) => expect(toPublicUrl(input)).toBe(expected));
});

describe("deleteObject", () => {
  it("deletes a stored key", async () => {
    s3.on(DeleteObjectCommand).resolves({});
    await deleteObject("covers/old.png");
    expect(s3.commandCalls(DeleteObjectCommand)[0].args[0].input)
      .toEqual({ Bucket: "test-images", Key: "covers/old.png" });
  });
  it("logs failure without rejecting", async () => {
    s3.on(DeleteObjectCommand).rejects(new Error("S3 unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(deleteObject("covers/old.png")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Could not delete S3 object", expect.objectContaining({ key: "covers/old.png" }));
  });
  it("does not try to delete an external URL", async () => {
    await deleteObject("https://blog.example/photo.jpg");
    expect(s3.calls()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npx vitest run src/lib/storage/s3.test.ts
```

Expected: FAIL — missing `@/lib/storage/s3`.

- [ ] **Step 3: Create the module**

Create `src/lib/storage/s3.ts`:

```ts
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/lib/config";

const s3 = new S3Client({ region: config.region, credentials: config.credentials });
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic",
};
type UploadInput = { fileName: string; contentType: string; size: number };

export async function presignUpload(input: UploadInput): Promise<{ key: string; uploadUrl: string }> {
  if (typeof input.fileName !== "string" || !input.fileName.trim()) {
    throw new Error("Invalid file name");
  }
  const ext = Object.hasOwn(extensions, input.contentType) ? extensions[input.contentType] : undefined;
  if (!ext) throw new Error("Unsupported image content type");
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > 10 * 1024 * 1024) {
    throw new Error("Invalid image size (maximum 10 MiB)");
  }
  const key = `covers/${randomUUID()}.${ext}`;
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: config.bucketName, Key: key, ContentType: input.contentType, ContentLength: input.size,
  }), { expiresIn: 300 });
  return { key, uploadUrl };
}

export function toPublicUrl(keyOrUrl: string): string {
  return keyOrUrl.startsWith("https://") ? keyOrUrl : `https://${config.imageCdnHost}/${keyOrUrl}`;
}

export async function deleteObject(key: string): Promise<void> {
  if (key.startsWith("https://")) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
  } catch (error) {
    console.error("Could not delete S3 object", { key, error });
  }
}
```

The requested metadata is validated before signing; this helper does not inspect image bytes. The future client must send the signed content length/type. No gallery presign/API is added. SDK signing follows the [S3 v3 examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html).

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/lib/storage/s3.test.ts
npx tsc --noEmit --incremental false
git add src/lib/storage/s3.ts src/lib/storage/s3.test.ts
git commit -m "feat: add validated S3 presign and image URL helpers"
```

Expected: **1 file / 20 tests** pass; typecheck exits 0.

---

### Task 3: Recipe repository

**Files:**
- Create: `src/lib/db/recipes-repo.ts`
- Modify: none
- Test: `src/lib/db/recipes-repo.test.ts`

**Interfaces:**
- Produces: `recipesRepo.list(filters?: { favorite?: boolean; categoryId?: string }): Promise<RecipeSummary[]>`, `recipesRepo.getById(id: string): Promise<Recipe>`, `recipesRepo.create(input: CreateRecipeInput, overrides?: RecipeOverrides): Promise<Recipe>`, `recipesRepo.update(id: string, patch: RecipePatch): Promise<Recipe>`, `recipesRepo.delete(id: string): Promise<void>`, `recipesRepo.setFavorite(id: string, value: boolean): Promise<Recipe>`.
- Consumes: Task 1 types/client/keys/errors; Task 2 `toPublicUrl` and `deleteObject`. Category cleanup consumes `list` and `update` in Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/lib/db/recipes-repo.test.ts`:

```ts
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateRecipeInput, Recipe } from "@/lib/types";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { recipesRepo } from "@/lib/db/recipes-repo";

vi.mock("@/lib/config", () => ({ config: {
  region: "us-east-2", tableName: "test-table", bucketName: "test-images",
  imageCdnHost: "d2gmo95al03pdi.cloudfront.net",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
} }));
const ddb = mockClient(DynamoDBDocumentClient);
const s3 = mockClient(S3Client);
const input: CreateRecipeInput = {
  title: "Soup", ingredients: [{ name: "water", amount: "1", unit: "cup" }],
  instructions: [{ stepNumber: 1, text: "Boil" }], notes: null, sourceUrl: null,
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: false, categoryIds: ["c1"], tags: ["easy"], photos: [{ key: "photos/r1/a.png", sortOrder: 0 }],
  coverImage: "covers/old.png",
};
function item(patch: Partial<Recipe> = {}) {
  const recipe = { ...input, id: "r1", createdAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-19T00:00:00.000Z", ...patch };
  return { ...recipe, PK: `RECIPE#${recipe.id}`, SK: "RECIPE", GSI1PK: "RECIPE", GSI1SK: `${recipe.createdAt}#${recipe.id}` };
}
const conditional = Object.assign(new Error("condition failed"), { name: "ConditionalCheckFailedException" });
beforeEach(() => { ddb.reset(); s3.reset(); s3.on(DeleteObjectCommand).resolves({}); });
afterEach(() => vi.restoreAllMocks());

describe("recipesRepo", () => {
  it("queries newest first through empty pages and filters favorites and categories", async () => {
    const cursor = { PK: "RECIPE#cursor", SK: "RECIPE" };
    ddb.on(QueryCommand)
      .resolvesOnce({ LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [item({ id: "new", isFavorite: true }), item({ id: "other", isFavorite: true, categoryIds: ["c2"] })], LastEvaluatedKey: { PK: "RECIPE#other", SK: "RECIPE" } })
      .resolvesOnce({ Items: [item({ id: "old", isFavorite: true }), item()], LastEvaluatedKey: {} });
    const result = await recipesRepo.list({ favorite: true, categoryId: "c1" });
    expect(result.map((r) => r.id)).toEqual(["new", "old"]);
    expect(result[0].coverImage).toBe("https://d2gmo95al03pdi.cloudfront.net/covers/old.png");
    expect(result[0]).not.toHaveProperty("PK");
    expect(result[0]).not.toHaveProperty("ingredients");
    const queries = ddb.commandCalls(QueryCommand).map((call) => call.args[0].input);
    expect(queries).toHaveLength(3);
    expect(queries[0]).toEqual({ TableName: "test-table", IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :kind", ExpressionAttributeValues: { ":kind": "RECIPE" },
      ScanIndexForward: false, ExclusiveStartKey: undefined });
    expect(queries[1].ExclusiveStartKey).toEqual(cursor);
    expect(queries.every((q) => !q.FilterExpression && !q.ConsistentRead)).toBe(true);
  });

  it("lists without filters and supports favorite false", async () => {
    ddb.on(QueryCommand).resolves({ Items: [item(), item({ id: "r2", isFavorite: true, coverImage: null })] });
    expect(await recipesRepo.list()).toHaveLength(2);
    expect((await recipesRepo.list({ favorite: false })).map((r) => r.id)).toEqual(["r1"]);
  });

  it("returns a full recipe without table metadata and preserves external URLs", async () => {
    ddb.on(GetCommand).resolves({ Item: item({ coverImage: "https://blog.example/a.jpg" }) });
    const result = await recipesRepo.getById("r1");
    expect(result.coverImage).toBe("https://blog.example/a.jpg");
    expect(result.ingredients).toEqual(input.ingredients);
    expect(result.photos).toEqual(input.photos);
    expect(result).not.toHaveProperty("GSI1SK");
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: "test-table", Key: { PK: "RECIPE#r1", SK: "RECIPE" }, ConsistentRead: true,
    });
  });

  it("throws a typed error when get misses", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(recipesRepo.getById("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a recipe with generated id and timestamps without mutating input", async () => {
    ddb.on(PutCommand).resolves({});
    const before = structuredClone(input);
    const result = await recipesRepo.create(input);
    const stored = ddb.commandCalls(PutCommand)[0].args[0].input.Item!;
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.createdAt).toBe(stored.updatedAt);
    expect(stored.coverImage).toBe("covers/old.png");
    expect(stored.PK).toBe(`RECIPE#${result.id}`);
    expect(stored.GSI1SK).toBe(`${result.createdAt}#${result.id}`);
    expect(input).toEqual(before);
  });

  it("preserves migration overrides and null covers", async () => {
    ddb.on(PutCommand).resolves({});
    const overrides = { id: "original-id", createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2021-01-01T00:00:00.000Z" };
    const result = await recipesRepo.create({ ...input, coverImage: null }, overrides);
    expect(result).toMatchObject({ ...overrides, coverImage: null });
    expect(ddb.commandCalls(PutCommand)[0].args[0].input.Item).toMatchObject({
      PK: "RECIPE#original-id", GSI1SK: `${overrides.createdAt}#original-id`,
    });
  });

  it("updates only allowed defined fields and preserves stored cover keys", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: item() });
    const patch = { title: "Stew", notes: undefined, id: "injected", PK: "bad" };
    const result = await recipesRepo.update("r1", patch);
    const command = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(Object.values(command.ExpressionAttributeNames!)).toEqual(["title", "updatedAt"]);
    expect(command).toMatchObject({ ConditionExpression: "attribute_exists(PK)", ReturnValues: "ALL_OLD" });
    expect(result).toMatchObject({ id: "r1", title: "Stew", createdAt: item().createdAt });
    expect(result.coverImage).toBe("https://d2gmo95al03pdi.cloudfront.net/covers/old.png");
    expect(s3.calls()).toHaveLength(0);
  });

  it("deletes the previous raw key after cover replacement even when S3 fails", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: item() });
    s3.on(DeleteObjectCommand).rejects(new Error("S3 down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recipesRepo.update("r1", { coverImage: "covers/new.png" })).resolves.toMatchObject({
      coverImage: "https://d2gmo95al03pdi.cloudfront.net/covers/new.png",
    });
    expect(s3.commandCalls(DeleteObjectCommand)[0].args[0].input.Key).toBe("covers/old.png");
    expect(log).toHaveBeenCalled();
  });

  it("supports clearing a cover and skips cleanup for an unchanged cover", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: item() });
    expect((await recipesRepo.update("r1", { coverImage: null })).coverImage).toBeNull();
    expect(s3.commandCalls(DeleteObjectCommand)).toHaveLength(1);
    s3.resetHistory();
    await recipesRepo.update("r1", { coverImage: "covers/old.png" });
    expect(s3.calls()).toHaveLength(0);
  });

  it("updates favorite through a conditional patch without writing the cover URL", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: item() });
    expect((await recipesRepo.setFavorite("r1", true)).isFavorite).toBe(true);
    expect(Object.values(ddb.commandCalls(UpdateCommand)[0].args[0].input.ExpressionAttributeNames!))
      .toEqual(["isFavorite", "updatedAt"]);
  });

  it("maps missing updates and deletes to NotFoundError without S3 calls", async () => {
    ddb.on(UpdateCommand).rejects(conditional);
    ddb.on(DeleteCommand).rejects(conditional);
    await expect(recipesRepo.update("missing", {})).rejects.toBeInstanceOf(NotFoundError);
    await expect(recipesRepo.delete("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(s3.calls()).toHaveLength(0);
  });

  it("deletes the recipe before best-effort deletion of its old cover", async () => {
    ddb.on(DeleteCommand).resolves({ Attributes: item() });
    s3.on(DeleteObjectCommand).rejects(new Error("S3 down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recipesRepo.delete("r1")).resolves.toBeUndefined();
    expect(ddb.commandCalls(DeleteCommand)[0].args[0].input).toEqual({
      TableName: "test-table", Key: { PK: "RECIPE#r1", SK: "RECIPE" },
      ConditionExpression: "attribute_exists(PK)", ReturnValues: "ALL_OLD",
    });
    expect(s3.commandCalls(DeleteObjectCommand)[0].args[0].input.Key).toBe("covers/old.png");
  });

  it("skips external and absent cover cleanup", async () => {
    ddb.on(DeleteCommand).resolvesOnce({ Attributes: item({ coverImage: "https://blog.example/a.png" }) })
      .resolvesOnce({ Attributes: item({ coverImage: null }) });
    await recipesRepo.delete("r1");
    await recipesRepo.delete("r1");
    expect(s3.calls()).toHaveLength(0);
  });

  it("propagates database failures and does not run S3 cleanup", async () => {
    const error = new Error("DynamoDB unavailable");
    ddb.on(QueryCommand).rejects(error); ddb.on(GetCommand).rejects(error);
    ddb.on(PutCommand).rejects(error); ddb.on(UpdateCommand).rejects(error); ddb.on(DeleteCommand).rejects(error);
    await expect(recipesRepo.list()).rejects.toBe(error);
    await expect(recipesRepo.getById("r1")).rejects.toBe(error);
    await expect(recipesRepo.create(input)).rejects.toBe(error);
    await expect(recipesRepo.update("r1", { coverImage: null })).rejects.toBe(error);
    await expect(recipesRepo.delete("r1")).rejects.toBe(error);
    expect(s3.calls()).toHaveLength(0);
    expect(error).not.toBeInstanceOf(ConflictError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npx vitest run src/lib/db/recipes-repo.test.ts
```

Expected: FAIL — missing `@/lib/db/recipes-repo`.

- [ ] **Step 3: Create the repository**

Create `src/lib/db/recipes-repo.ts`:

```ts
import { randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { CreateRecipeInput, Recipe, RecipeOverrides, RecipePatch, RecipeSummary } from "@/lib/types";
import { db, tableName } from "@/lib/db/client";
import { NotFoundError } from "@/lib/db/errors";
import { recipeIndex, recipeKey, type IndexKey, type TableKey } from "@/lib/db/keys";
import { deleteObject, toPublicUrl } from "@/lib/storage/s3";

type RecipeItem = Recipe & TableKey & IndexKey;
type Filters = { favorite?: boolean; categoryId?: string };
const writable = [
  "title", "ingredients", "instructions", "notes", "sourceUrl", "cookTime", "prepTime", "servings",
  "calories", "protein", "carbs", "fat", "isFavorite", "categoryIds", "tags", "photos", "coverImage",
] as const satisfies readonly (keyof CreateRecipeInput)[];

function publicRecipe(item: RecipeItem): Recipe {
  const { PK, SK, GSI1PK, GSI1SK, ...recipe } = item;
  void PK; void SK; void GSI1PK; void GSI1SK;
  return { ...recipe, coverImage: recipe.coverImage === null ? null : toPublicUrl(recipe.coverImage) };
}

async function list(filters: Filters = {}): Promise<RecipeSummary[]> {
  let cursor: QueryCommandInput["ExclusiveStartKey"];
  let items: RecipeItem[] = [];
  do {
    const page = await db.send(new QueryCommand({
      TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "GSI1PK = :kind",
      ExpressionAttributeValues: { ":kind": "RECIPE" }, ScanIndexForward: false, ExclusiveStartKey: cursor,
    }));
    items = [...items, ...((page.Items ?? []) as RecipeItem[])];
    cursor = page.LastEvaluatedKey;
  } while (cursor && Object.keys(cursor).length > 0);
  return items.filter((recipe) =>
    (filters.favorite === undefined || recipe.isFavorite === filters.favorite) &&
    (filters.categoryId === undefined || recipe.categoryIds.includes(filters.categoryId))
  ).map((item) => {
    const { id, title, coverImage, isFavorite, categoryIds, createdAt } = publicRecipe(item);
    return { id, title, coverImage, isFavorite, categoryIds, createdAt };
  });
}

async function getById(id: string): Promise<Recipe> {
  const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: recipeKey(id), ConsistentRead: true }));
  if (!Item) throw new NotFoundError("Recipe not found");
  return publicRecipe(Item as RecipeItem);
}

async function create(input: CreateRecipeInput, overrides: RecipeOverrides = {}): Promise<Recipe> {
  const now = new Date().toISOString();
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.createdAt ?? now;
  const item: RecipeItem = {
    ...input, id, createdAt, updatedAt: overrides.updatedAt ?? createdAt,
    ...recipeKey(id), ...recipeIndex(id, createdAt),
  };
  await db.send(new PutCommand({ TableName: tableName, Item: item }));
  return publicRecipe(item);
}

async function translateMissing<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      throw new NotFoundError("Recipe not found");
    }
    throw error;
  }
}

async function update(id: string, patch: RecipePatch): Promise<Recipe> {
  const changes = Object.fromEntries(writable.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]));
  const entries = Object.entries({ ...changes, updatedAt: new Date().toISOString() });
  const names = Object.fromEntries(entries.map(([key], index) => [`#f${index}`, key]));
  const values = Object.fromEntries(entries.map(([, value], index) => [`:v${index}`, value]));
  const result = await translateMissing(() => db.send(new UpdateCommand({
    TableName: tableName, Key: recipeKey(id), ConditionExpression: "attribute_exists(PK)",
    UpdateExpression: `SET ${entries.map((_, index) => `#f${index} = :v${index}`).join(", ")}`,
    ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: "ALL_OLD",
  })));
  const old = result.Attributes as RecipeItem;
  const next = { ...old, ...changes, updatedAt: entries[entries.length - 1][1] } as RecipeItem;
  if (old.coverImage && changes.coverImage !== undefined && old.coverImage !== changes.coverImage) {
    await deleteObject(old.coverImage);
  }
  return publicRecipe(next);
}

async function remove(id: string): Promise<void> {
  const result = await translateMissing(() => db.send(new DeleteCommand({
    TableName: tableName, Key: recipeKey(id), ConditionExpression: "attribute_exists(PK)", ReturnValues: "ALL_OLD",
  })));
  const old = result.Attributes as RecipeItem;
  if (old.coverImage) await deleteObject(old.coverImage);
}

async function setFavorite(id: string, value: boolean): Promise<Recipe> {
  return update(id, { isFavorite: value });
}

export const recipesRepo = { list, getById, create, update, delete: remove, setFavorite };
```

`UpdateCommand` returns the actual previous item via `ALL_OLD`; this avoids fetching a public URL before a write and ensures cleanup uses the replaced key. Only allowlisted patch fields are written, so primary/index keys and creation time remain intact. Fixed-ID `PutCommand` is intentionally idempotent for the later migration; regular creation generates a UUID. No migration script is added here.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/lib/db/recipes-repo.test.ts
npx tsc --noEmit --incremental false
git add src/lib/db/recipes-repo.ts src/lib/db/recipes-repo.test.ts
git commit -m "feat: add tested DynamoDB recipe repository"
```

Expected: **1 file / 14 tests** pass; typecheck exits 0. Mock behavior uses the documented [aws-sdk-client-mock API](https://github.com/m-radzikowski/aws-sdk-client-mock), including `resolvesOnce` and `commandCalls` with ordinary Vitest assertions.

---

### Task 4: Category repository with transactional uniqueness

**Files:**
- Create: `src/lib/db/categories-repo.ts`
- Modify: none
- Test: `src/lib/db/categories-repo.test.ts`

**Interfaces:**
- Produces: `categoriesRepo.list(): Promise<Category[]>`, `categoriesRepo.getById(id: string): Promise<Category>`, `categoriesRepo.create(input: CreateCategoryInput, overrides?: { id?: string }): Promise<Category>`, `categoriesRepo.rename(id: string, name: string): Promise<Category>`, `categoriesRepo.setEmoji(id: string, emoji: string | null): Promise<Category>`, `categoriesRepo.delete(id: string): Promise<void>`.
- Consumes: Task 1 client/keys/errors/types; `recipesRepo.list({ categoryId }): Promise<RecipeSummary[]>`, `recipesRepo.update(id, { categoryIds }): Promise<Recipe>`. No circular dependency: recipes never import categories.

- [ ] **Step 1: Write the failing test**

Create `src/lib/db/categories-repo.test.ts`:

```ts
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { categoriesRepo } from "@/lib/db/categories-repo";
import { ConflictError, NotFoundError } from "@/lib/db/errors";

vi.mock("@/lib/config", () => ({ config: {
  region: "us-east-2", tableName: "test-table", bucketName: "test-images",
  imageCdnHost: "d2gmo95al03pdi.cloudfront.net",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
} }));
const ddb = mockClient(DynamoDBDocumentClient);
const category = {
  PK: "CATEGORY#c1", SK: "CATEGORY", GSI1PK: "CATEGORY", GSI1SK: "dinner",
  id: "c1", name: "Dinner", emoji: null, createdAt: "2026-10-19T00:00:00.000Z",
};
const recipe = {
  PK: "RECIPE#r1", SK: "RECIPE", GSI1PK: "RECIPE", GSI1SK: "2026-10-19T00:00:00.000Z#r1",
  id: "r1", title: "Soup", ingredients: [], instructions: [], notes: null, sourceUrl: null,
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: true, categoryIds: ["c1", "c2"], tags: [], photos: [], coverImage: "covers/keep.png",
  createdAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-19T00:00:00.000Z",
};
function canceled(codes: string[]) {
  return Object.assign(new Error("Transaction canceled"), {
    name: "TransactionCanceledException", CancellationReasons: codes.map((Code) => ({ Code })),
  });
}
function tx() { return ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!; }
beforeEach(() => {
  ddb.reset();
  ddb.on(GetCommand).resolves({ Item: category });
  ddb.on(TransactWriteCommand).resolves({});
  ddb.on(QueryCommand).resolves({ Items: [] });
});

describe("categoriesRepo", () => {
  it("queries categories alphabetically through every page and strips table keys", async () => {
    const cursor = { PK: "CATEGORY#c1", SK: "CATEGORY" };
    ddb.on(QueryCommand).resolvesOnce({ LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [category], LastEvaluatedKey: {} });
    expect(await categoriesRepo.list()).toEqual([{
      id: "c1", name: "Dinner", emoji: null, createdAt: category.createdAt,
    }]);
    const queries = ddb.commandCalls(QueryCommand).map((call) => call.args[0].input);
    expect(queries[0]).toEqual({ TableName: "test-table", IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :kind", ExpressionAttributeValues: { ":kind": "CATEGORY" },
      ScanIndexForward: true, ExclusiveStartKey: undefined });
    expect(queries[1].ExclusiveStartKey).toEqual(cursor);
  });

  it("reads a category consistently", async () => {
    expect(await categoriesRepo.getById("c1")).toMatchObject({ name: "Dinner", emoji: null });
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: "test-table", Key: { PK: "CATEGORY#c1", SK: "CATEGORY" }, ConsistentRead: true,
    });
  });

  it("throws for a missing category", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(categoriesRepo.getById("missing")).rejects.toBeInstanceOf(NotFoundError);
    await expect(categoriesRepo.rename("missing", "Lunch")).rejects.toBeInstanceOf(NotFoundError);
    await expect(categoriesRepo.delete("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates the uniqueness item and category in one transaction", async () => {
    const result = await categoriesRepo.create({ name: " Dinner ", emoji: null }, { id: "c1" });
    expect(result).toMatchObject({ id: "c1", name: "Dinner", emoji: null });
    expect(tx()).toEqual([
      { Put: { TableName: "test-table", Item: { PK: "CATEGORYNAME#dinner", SK: "CATEGORYNAME" }, ConditionExpression: "attribute_not_exists(PK)" } },
      { Put: { TableName: "test-table", Item: { ...category, createdAt: result.createdAt }, ConditionExpression: "attribute_not_exists(PK)" } },
    ]);
  });

  it("generates a category id when no override is supplied", async () => {
    expect((await categoriesRepo.create({ name: "Lunch", emoji: "L" })).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects blank names before writing", async () => {
    await expect(categoriesRepo.create({ name: " ", emoji: null })).rejects.toThrow("name");
    await expect(categoriesRepo.rename("c1", " ")).rejects.toThrow("name");
    expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it.each([0, 1])("maps create conditional failure at action %s to ConflictError", async (index) => {
    ddb.on(TransactWriteCommand).rejects(canceled(index === 0 ? ["ConditionalCheckFailed", "None"] : ["None", "ConditionalCheckFailed"]));
    await expect(categoriesRepo.create({ name: "DINNER", emoji: null })).rejects.toBeInstanceOf(ConflictError);
  });

  it("propagates transaction failures with no conditional reason", async () => {
    const error = canceled(["ProvisionedThroughputExceeded", "None"]);
    ddb.on(TransactWriteCommand).rejects(error);
    await expect(categoriesRepo.create({ name: "Dinner", emoji: null })).rejects.toBe(error);
  });

  it("propagates cancellations without reasons and other AWS errors", async () => {
    const noReasons = Object.assign(new Error("Canceled"), { name: "TransactionCanceledException" });
    const denied = new Error("Access denied");
    ddb.on(TransactWriteCommand).rejectsOnce(noReasons).rejectsOnce(denied);
    await expect(categoriesRepo.create({ name: "Dinner", emoji: null })).rejects.toBe(noReasons);
    await expect(categoriesRepo.create({ name: "Dinner", emoji: null })).rejects.toBe(denied);
  });

  it("renames with a guarded category update and atomic uniqueness swap", async () => {
    expect(await categoriesRepo.rename("c1", " Lunch ")).toMatchObject({ name: "Lunch", createdAt: category.createdAt });
    expect(tx()).toHaveLength(3);
    expect(tx()[0].Update).toMatchObject({ Key: { PK: "CATEGORY#c1", SK: "CATEGORY" },
      ConditionExpression: "attribute_exists(PK) AND #name = :old",
      ExpressionAttributeValues: { ":name": "Lunch", ":sort": "lunch", ":old": "Dinner" } });
    expect(tx()[1].Delete).toEqual({ TableName: "test-table", Key: { PK: "CATEGORYNAME#dinner", SK: "CATEGORYNAME" } });
    expect(tx()[2].Put).toEqual({ TableName: "test-table", Item: { PK: "CATEGORYNAME#lunch", SK: "CATEGORYNAME" },
      ConditionExpression: "attribute_not_exists(PK)" });
  });

  it("handles a case-only rename without targeting the uniqueness item twice", async () => {
    expect((await categoriesRepo.rename("c1", "DINNER")).name).toBe("DINNER");
    expect(tx()).toHaveLength(1);
    expect(tx()[0].Update?.ExpressionAttributeValues).toMatchObject({ ":sort": "dinner" });
  });

  it("rejects a duplicate rename", async () => {
    ddb.on(TransactWriteCommand).rejects(canceled(["None", "None", "ConditionalCheckFailed"]));
    await expect(categoriesRepo.rename("c1", "Lunch")).rejects.toBeInstanceOf(ConflictError);
  });

  it("reports a concurrent rename as a conflict without deleting a newer lock", async () => {
    ddb.on(GetCommand).resolvesOnce({ Item: category }).resolvesOnce({ Item: { ...category, name: "Brunch" } });
    ddb.on(TransactWriteCommand).rejects(canceled(["ConditionalCheckFailed", "None", "None"]));
    await expect(categoriesRepo.rename("c1", "Lunch")).rejects.toBeInstanceOf(ConflictError);
    expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(1);
  });

  it("reports a category removed during a transaction as missing", async () => {
    ddb.on(GetCommand).resolvesOnce({ Item: category }).resolvesOnce({});
    ddb.on(TransactWriteCommand).rejects(canceled(["ConditionalCheckFailed", "None"]));
    await expect(categoriesRepo.delete("c1")).rejects.toBeInstanceOf(NotFoundError);
    expect(ddb.commandCalls(QueryCommand)).toHaveLength(0);
  });

  it("sets and clears emoji with a conditional update", async () => {
    ddb.on(UpdateCommand).resolvesOnce({ Attributes: { ...category, emoji: "L" } })
      .resolvesOnce({ Attributes: category });
    expect((await categoriesRepo.setEmoji("c1", "L")).emoji).toBe("L");
    expect((await categoriesRepo.setEmoji("c1", null)).emoji).toBeNull();
    expect(ddb.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      ConditionExpression: "attribute_exists(PK)", UpdateExpression: "SET emoji = :emoji", ReturnValues: "ALL_NEW",
    });
  });

  it("maps only missing emoji updates to NotFoundError", async () => {
    const missing = Object.assign(new Error("Missing"), { name: "ConditionalCheckFailedException" });
    const error = new Error("DynamoDB down");
    ddb.on(UpdateCommand).rejectsOnce(missing).rejectsOnce(error);
    await expect(categoriesRepo.setEmoji("missing", null)).rejects.toBeInstanceOf(NotFoundError);
    await expect(categoriesRepo.setEmoji("c1", null)).rejects.toBe(error);
  });

  it("deletes both category items, then removes only its id from matching recipes", async () => {
    const cursor = { PK: "RECIPE#r1", SK: "RECIPE" };
    ddb.on(QueryCommand).resolvesOnce({ Items: [{ ...recipe, id: "other", categoryIds: ["c2"] }], LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [recipe] });
    ddb.on(UpdateCommand).resolves({ Attributes: recipe });
    await categoriesRepo.delete("c1");
    expect(tx()).toEqual([
      { Delete: { TableName: "test-table", Key: { PK: "CATEGORY#c1", SK: "CATEGORY" },
        ConditionExpression: "attribute_exists(PK) AND #name = :old",
        ExpressionAttributeNames: { "#name": "name" }, ExpressionAttributeValues: { ":old": "Dinner" } } },
      { Delete: { TableName: "test-table", Key: { PK: "CATEGORYNAME#dinner", SK: "CATEGORYNAME" } } },
    ]);
    const update = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(1);
    expect(Object.values(update.ExpressionAttributeNames!)).toEqual(["categoryIds", "updatedAt"]);
    expect(update.ExpressionAttributeValues![":v0"]).toEqual(["c2"]);
    expect(recipe.categoryIds).toEqual(["c1", "c2"]);
    expect(ddb.calls()[1].args[0]).toBeInstanceOf(TransactWriteCommand);
    expect(ddb.calls()[2].args[0]).toBeInstanceOf(QueryCommand);
  });

  it("tolerates a recipe concurrently deleted during cleanup", async () => {
    ddb.on(QueryCommand).resolves({ Items: [recipe] });
    ddb.on(UpdateCommand).rejects(Object.assign(new Error("Missing"), { name: "ConditionalCheckFailedException" }));
    await expect(categoriesRepo.delete("c1")).resolves.toBeUndefined();
  });

  it("fails loudly if recipe cleanup cannot finish", async () => {
    const error = new Error("DynamoDB unavailable");
    ddb.on(QueryCommand).resolves({ Items: [recipe] });
    ddb.on(UpdateCommand).rejects(error);
    await expect(categoriesRepo.delete("c1")).rejects.toBe(error);
  });

  it("propagates read errors without starting category writes", async () => {
    const error = new Error("DynamoDB unavailable");
    ddb.on(GetCommand).rejects(error); ddb.on(QueryCommand).rejects(error);
    await expect(categoriesRepo.getById("c1")).rejects.toBe(error);
    await expect(categoriesRepo.list()).rejects.toBe(error);
    expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npx vitest run src/lib/db/categories-repo.test.ts
```

Expected: FAIL — missing `@/lib/db/categories-repo`.

- [ ] **Step 3: Create the repository**

Create `src/lib/db/categories-repo.ts`:

```ts
import { randomUUID } from "node:crypto";
import { GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand, type QueryCommandInput, type TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import type { Category, CreateCategoryInput } from "@/lib/types";
import { db, tableName } from "@/lib/db/client";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { categoryIndex, categoryKey, categoryNameKey } from "@/lib/db/keys";
import { recipesRepo } from "@/lib/db/recipes-repo";

function domain(item: Record<string, unknown>): Category {
  return { id: item.id as string, name: item.name as string, emoji: item.emoji as string | null, createdAt: item.createdAt as string };
}
function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");
  return trimmed;
}

async function list(): Promise<Category[]> {
  let cursor: QueryCommandInput["ExclusiveStartKey"];
  let categories: Category[] = [];
  do {
    const page = await db.send(new QueryCommand({
      TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "GSI1PK = :kind",
      ExpressionAttributeValues: { ":kind": "CATEGORY" }, ScanIndexForward: true, ExclusiveStartKey: cursor,
    }));
    categories = [...categories, ...(page.Items ?? []).map(domain)];
    cursor = page.LastEvaluatedKey;
  } while (cursor && Object.keys(cursor).length > 0);
  return categories;
}

async function getById(id: string): Promise<Category> {
  const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: categoryKey(id), ConsistentRead: true }));
  if (!Item) throw new NotFoundError("Category not found");
  return domain(Item);
}

async function transact(items: TransactWriteCommandInput["TransactItems"], conflicts: number[], id?: string): Promise<void> {
  try {
    await db.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "TransactionCanceledException") throw error;
    const reasons = (error as Error & { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
    if (conflicts.some((index) => reasons[index]?.Code === "ConditionalCheckFailed")) {
      throw new ConflictError("Category name or id already exists");
    }
    if (id && reasons[0]?.Code === "ConditionalCheckFailed") {
      await getById(id);
      throw new ConflictError("Category changed; reload and try again");
    }
    throw error;
  }
}

async function create(input: CreateCategoryInput, overrides: { id?: string } = {}): Promise<Category> {
  const name = cleanName(input.name);
  const id = overrides.id ?? randomUUID();
  const category: Category = { id, name, emoji: input.emoji, createdAt: new Date().toISOString() };
  await transact([
    { Put: { TableName: tableName, Item: categoryNameKey(name), ConditionExpression: "attribute_not_exists(PK)" } },
    { Put: { TableName: tableName, Item: { ...category, ...categoryKey(id), ...categoryIndex(name) }, ConditionExpression: "attribute_not_exists(PK)" } },
  ], [0, 1]);
  return category;
}

async function rename(id: string, inputName: string): Promise<Category> {
  const name = cleanName(inputName);
  const current = await getById(id);
  const update = { Update: {
    TableName: tableName, Key: categoryKey(id), ConditionExpression: "attribute_exists(PK) AND #name = :old",
    UpdateExpression: "SET #name = :name, GSI1SK = :sort",
    ExpressionAttributeNames: { "#name": "name" },
    ExpressionAttributeValues: { ":name": name, ":sort": name.toLowerCase(), ":old": current.name },
  } };
  const sameKey = current.name.toLowerCase() === name.toLowerCase();
  const items = sameKey ? [update] : [
    update,
    { Delete: { TableName: tableName, Key: categoryNameKey(current.name) } },
    { Put: { TableName: tableName, Item: categoryNameKey(name), ConditionExpression: "attribute_not_exists(PK)" } },
  ];
  await transact(items, sameKey ? [] : [2], id);
  return { ...current, name };
}

async function setEmoji(id: string, emoji: string | null): Promise<Category> {
  try {
    const { Attributes } = await db.send(new UpdateCommand({
      TableName: tableName, Key: categoryKey(id), ConditionExpression: "attribute_exists(PK)",
      UpdateExpression: "SET emoji = :emoji", ExpressionAttributeValues: { ":emoji": emoji }, ReturnValues: "ALL_NEW",
    }));
    return domain(Attributes!);
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      throw new NotFoundError("Category not found");
    }
    throw error;
  }
}

async function remove(id: string): Promise<void> {
  const current = await getById(id);
  await transact([
    { Delete: { TableName: tableName, Key: categoryKey(id),
      ConditionExpression: "attribute_exists(PK) AND #name = :old",
      ExpressionAttributeNames: { "#name": "name" }, ExpressionAttributeValues: { ":old": current.name } } },
    { Delete: { TableName: tableName, Key: categoryNameKey(current.name) } },
  ], [], id);
  const recipes = await recipesRepo.list({ categoryId: id });
  for (const recipe of recipes) {
    try {
      await recipesRepo.update(recipe.id, { categoryIds: recipe.categoryIds.filter((categoryId) => categoryId !== id) });
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
}

export const categoriesRepo = { list, getById, create, rename, setEmoji, delete: remove };
```

The name guard prevents a stale rename/delete from releasing a newer uniqueness lock. Case-only rename touches only the category item. `TransactWriteCommand` uses the service's `TransactWriteItems`; only uniqueness/ID conditional failures become `ConflictError`. If a category condition fails, a strong read distinguishes missing from concurrent change. Cleanup performs conditional recipe `UpdateItem` calls for category IDs/timestamps only, preserving covers/favorites and not resurrecting deleted recipes. Cleanup errors propagate; do not mark the operation successful after a database failure. The design uses an eventually consistent GSI and post-transaction cleanup, so it does not guarantee atomicity with concurrent recipe edits; stronger coordination belongs in a later design if needed.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npx vitest run src/lib/db/categories-repo.test.ts
npx tsc --noEmit --incremental false
git add src/lib/db/categories-repo.ts src/lib/db/categories-repo.test.ts
git commit -m "feat: add transactional DynamoDB category repository"
```

Expected: **1 file / 21 tests** pass; typecheck exits 0.

---

### Task 5: Real-table round-trip and resume evidence (human, guided)

This task alone creates the app access key and touches the real empty development table. Run it as the human with the assistant alongside. It creates no infrastructure and touches no Supabase data. Keep the new resume claim `planned` until the live script succeeds.

**Files:**
- Create temporarily: `scripts/phase-2-smoke.ts` (remove before committing)
- Modify: `.env.local` (local/ignored), `docs/resume-highlights.md`
- Test temporarily: `src/lib/db/phase-2-smoke.test.ts` (remove with the temporary script)

**Interfaces:**
- Produces: `runSmoke(repo?: Pick<typeof recipesRepo, "create" | "list" | "delete" | "getById">, id?: string, pause?: (ms: number) => Promise<void>): Promise<void>` and a CLI entrypoint; assertion failure/cleanup failure gives a nonzero exit code.
- Consumes: Task 3 repository API, six `.env.local` values, existing `infra/node_modules/.bin/tsx.cmd`. The CLI profile remains `cute-cookbook-project`; SDK clients use the explicit app-user credential pair from config.

- [ ] **Step 1: Record the Phase 2 claim as planned**

Append exactly this bullet to `## Bullet points` in `docs/resume-highlights.md`; leave all other claims/tags intact:

```markdown
- `planned` Built a tested AWS data layer for a Next.js app: DynamoDB repositories with paginated queries and transactional category-name uniqueness, plus validated five-minute S3 presigned uploads, CloudFront URL resolution, and best-effort cover cleanup; verified recipe create/list/delete against the real table with no leftover smoke data.
```

```powershell
git add docs/resume-highlights.md
git commit -m "docs: track Phase 2 data layer verification as planned"
```

Expected: only the new Phase 2 bullet is added; it remains `planned` through mocked tests and credential setup.

- [ ] **Step 2: Write the failing cleanup test**

Create temporary `src/lib/db/phase-2-smoke.test.ts`:

```ts
import { expect, it, vi } from "vitest";
import type { Recipe } from "@/lib/types";
import { NotFoundError } from "@/lib/db/errors";
import { runSmoke } from "../../../scripts/phase-2-smoke";

vi.mock("@/lib/db/recipes-repo", () => ({ recipesRepo: {} }));
const recipe: Recipe = {
  id: "smoke-test", title: "Phase 2 smoke", ingredients: [], instructions: [], notes: null, sourceUrl: null,
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: false, categoryIds: [], tags: [], photos: [], coverImage: null,
  createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z",
};

it("polls through an empty GSI result and deletes only its own recipe", async () => {
  const repo = {
    create: vi.fn().mockResolvedValue(recipe),
    list: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([recipe]),
    delete: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn().mockRejectedValue(new NotFoundError()),
  };
  const pause = vi.fn().mockResolvedValue(undefined);
  await runSmoke(repo, "smoke-test", pause);
  expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ coverImage: null }), { id: "smoke-test" });
  expect(repo.list).toHaveBeenCalledTimes(2);
  expect(pause).toHaveBeenCalledWith(1000);
  expect(repo.delete).toHaveBeenCalledExactlyOnceWith("smoke-test");
  expect(repo.getById).toHaveBeenCalledWith("smoke-test");
});

it("cleans up its item even when listing fails", async () => {
  const error = new Error("Query failed");
  const repo = {
    create: vi.fn().mockResolvedValue(recipe), list: vi.fn().mockRejectedValue(error),
    delete: vi.fn().mockResolvedValue(undefined), getById: vi.fn().mockRejectedValue(new NotFoundError()),
  };
  await expect(runSmoke(repo, "smoke-test", async () => {})).rejects.toBe(error);
  expect(repo.delete).toHaveBeenCalledExactlyOnceWith("smoke-test");
});
```

```powershell
npx vitest run src/lib/db/phase-2-smoke.test.ts
```

Expected: FAIL — temporary `scripts/phase-2-smoke.ts` does not exist yet. No real AWS calls occur.

- [ ] **Step 3: Create the throwaway script in full**

Create `scripts/phase-2-smoke.ts`:

```ts
import { randomUUID } from "node:crypto";
import { recipesRepo } from "@/lib/db/recipes-repo";
import { NotFoundError } from "@/lib/db/errors";
import type { CreateRecipeInput } from "@/lib/types";

type SmokeRepo = Pick<typeof recipesRepo, "create" | "list" | "delete" | "getById">;
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup(repo: SmokeRepo, id: string): Promise<void> {
  try {
    await repo.delete(id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }
  try {
    await repo.getById(id);
  } catch (error) {
    if (error instanceof NotFoundError) return;
    throw error;
  }
  throw new Error(`Smoke item still exists: ${id}`);
}

export async function runSmoke(repo: SmokeRepo = recipesRepo, id: string = randomUUID(), pause = wait): Promise<void> {
  const input: CreateRecipeInput = {
    title: "Phase 2 smoke", ingredients: [], instructions: [], notes: null, sourceUrl: null,
    cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
    isFavorite: false, categoryIds: [], tags: [], photos: [], coverImage: null,
  };
  console.log(`Smoke item id: ${id}`);
  try {
    await repo.create(input, { id });
    console.log("CREATE passed");
    let visible = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const recipes = await repo.list();
      if (recipes.some((recipe) => recipe.id === id)) { visible = true; break; }
      await pause(1000);
    }
    if (!visible) throw new Error(`GSI did not expose smoke item within 20 polls: ${id}`);
    console.log("LIST passed");
  } finally {
    try {
      await cleanup(repo, id);
      console.log("DELETE and strong-read absence passed");
    } catch (error) {
      console.error(`Cleanup failed; remove only smoke id ${id}`, error);
      throw error;
    }
  }
}

async function main(): Promise<void> {
  const { config } = await import("@/lib/config");
  if (config.region !== "us-east-2" || config.tableName !== "cute-cookbook" || !config.credentials) {
    throw new Error("Smoke requires us-east-2, cute-cookbook, and explicit app-user credentials");
  }
  if (process.argv[2] === "--cleanup") {
    const id = process.argv[3];
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new Error("Supply the exact smoke UUID printed by the failed run");
    await cleanup(recipesRepo, id);
    console.log(`Cleanup verified for ${id}`);
    return;
  }
  await runSmoke();
}

if (process.argv[1]?.endsWith("phase-2-smoke.ts")) {
  void main().catch((error) => { console.error(error); process.exitCode = 1; });
}
```

The UUID is allocated before the write. `finally` attempts to delete that exact key even if the create response is lost or the query fails. GSI visibility gets bounded polling; deletion is checked through a strong base-table read, never an immediately empty GSI. The script deletes no other recipes, uploads nothing, and prints no secrets. `--cleanup` is only for the exact UUID printed by a failed run.

```powershell
npx vitest run src/lib/db/phase-2-smoke.test.ts
```

Expected: PASS, **2 temporary tests**; no AWS network. The only throwaway script is this one; the colocated temporary test is removed in Step 7.

- [ ] **Step 4: Run the full local gates before touching AWS**

```powershell
npm test
npm run test:coverage -- --coverage.include="src/lib/db/**/*.ts" --coverage.include="src/lib/storage/**/*.ts" --coverage.exclude="**/*.test.ts" --coverage.thresholds.perFile --coverage.thresholds.statements=80 --coverage.thresholds.branches=80 --coverage.thresholds.functions=80 --coverage.thresholds.lines=80
npm run lint
npm run build
```

Expected: **12 files / 112 tests** while the temporary smoke test exists; coverage passes all four 80% per-file thresholds; lint/build exit 0. If a coverage branch needs another meaningful case, add it to the relevant existing test file and update the exact counts in Task 6/exit checklist. Do not lower thresholds or alter the shared Vitest config. The existing pages still use Supabase and do not import the production AWS config.

- [ ] **Step 5: Human creates only the app key and records local env**

Recheck the key inventory immediately before creation. Execute the create command **once**, only when the app key list is empty. If one already exists, reuse its locally stored secret rather than rotating or creating a duplicate. The following captures JSON into memory without echoing the secret:

```powershell
$env:AWS_PROFILE = "cute-cookbook-project"; $env:AWS_REGION = "us-east-2"
aws iam list-access-keys --user-name cute-cookbook-app --query "length(AccessKeyMetadata)" --output text
git check-ignore .env.local
```

Expected: `0` and `.env.local`; stop before the next block if it is tracked or not ignored. In AWS Settings > Billing, confirm the paid-plan/spend status recorded in prerequisites. No other user or credential is changed.

```powershell
$appKeyResult = aws iam create-access-key --user-name cute-cookbook-app --output json
if ($LASTEXITCODE -ne 0) { throw "App key creation failed" }
$appKey = ($appKeyResult | ConvertFrom-Json).AccessKey
$previousEnv = if (Test-Path -LiteralPath .env.local) { Get-Content -LiteralPath .env.local -ErrorAction Stop } else { @() }
$keptEnv = @($previousEnv | Where-Object { $_ -notmatch '^\s*(AWS_REGION|TABLE_NAME|BUCKET_NAME|IMAGE_CDN_HOST|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*=' })
$newAwsEnv = @(
  'AWS_REGION=us-east-2'
  'TABLE_NAME=cute-cookbook'
  'BUCKET_NAME=cutecookbookdata-imagesbucket1e86afb2-lnm24xf2wzzn'
  'IMAGE_CDN_HOST=d2gmo95al03pdi.cloudfront.net'
  "AWS_ACCESS_KEY_ID=$($appKey.AccessKeyId)"
  "AWS_SECRET_ACCESS_KEY=$($appKey.SecretAccessKey)"
)
Set-Content -LiteralPath .env.local -Value ($keptEnv + '' + $newAwsEnv) -Encoding utf8 -ErrorAction Stop
Remove-Variable appKeyResult, appKey, previousEnv, keptEnv, newAwsEnv
git check-ignore .env.local
git ls-files -- .env.local
```

Expected: `.env.local` ignored, no tracked path, all six AWS fields written while preserving existing Supabase/auth variables. Do not display the file. If writing the file fails, keep the captured key only long enough to save it securely; do not run key creation again. The deploy user's key still waits for Phase 6.

- [ ] **Step 6: Run the real-table script using the app credentials**

Use the existing infra `tsx` binary; do not add a root dependency or use an auto-installing `npx tsx`. Node's `--env-file` loads the gitignored file. Remove ambient AWS key/session overrides first because environment variables take precedence over env-file values. Keep the named CLI profile for later read-only CLI checks.

```powershell
if (-not (Test-Path -LiteralPath infra/node_modules/.bin/tsx.cmd)) { npm --prefix infra ci; if ($LASTEXITCODE -ne 0) { throw "Infra tooling install failed" } }
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
$env:AWS_PROFILE = "cute-cookbook-project"; $env:AWS_REGION = "us-east-2"
& .\infra\node_modules\.bin\tsx.cmd --env-file=.env.local scripts/phase-2-smoke.ts
if ($LASTEXITCODE -ne 0) { throw "Smoke failed; leave the resume bullet planned and verify the printed UUID was cleaned up" }
```

Expected: exit 0; `Smoke item id: <uuid>`, `CREATE passed`, `LIST passed`, `DELETE and strong-read absence passed`. Record this non-secret output as evidence. If cleanup failed, rerun the same script with `--cleanup <exact-printed-uuid>` after fixing connectivity/permissions, then rerun the full round-trip. Never scan/delete the entire table or touch production data. A smoke failure leaves the phase incomplete and the bullet `planned`.

- [ ] **Step 7: Remove temporary source/test; mark only the verified Phase 2 bullet done**

Only after successful live verification, change the newly added Phase 2 bullet tag from `planned` to `done`; keep the text and all other resume tags intact. Remove only these exact files, and rerun the durable suite:

```powershell
Remove-Item -LiteralPath scripts/phase-2-smoke.ts, src/lib/db/phase-2-smoke.test.ts
npm test
git status --short
git add docs/resume-highlights.md
git commit -m "docs: record verified Phase 2 data layer round-trip"
```

Expected: **11 files / 110 tests** pass, no temporary source/test or `.env.local` in the index, and the new bullet is `done`. If stopping after a failed smoke run, remove the temporary files after preserving its printed UUID and required cleanup instructions; the plan contains their full source for retry. Do not commit a `done` claim or advance to the PR task until the full smoke succeeds.

---

### Task 6: Final verification and PR to master

**Files:**
- Create: none
- Modify: none (only fix issues in the Phase 2 files above if a gate fails)
- Test: all durable `src/**/*.test.ts` plus the completed live smoke evidence

**Interfaces:**
- Produces: reviewed implementation PR `feat/aws-migration-phase-2` → `master`, passing local gates and `gh pr checks --watch`.
- Consumes: `recipesRepo.list(filters?: { favorite?: boolean; categoryId?: string }): Promise<RecipeSummary[]>`, `categoriesRepo.list(): Promise<Category[]>`, `presignUpload(input: { fileName: string; contentType: string; size: number }): Promise<{ key: string; uploadUrl: string }>`; all remain unconnected to existing UI/auth callers until Phase 3/4.

- [ ] **Step 1: Run the final durable gates and inspect scope**

```powershell
npm test
npm run test:coverage -- --coverage.include="src/lib/db/**/*.ts" --coverage.include="src/lib/storage/**/*.ts" --coverage.exclude="**/*.test.ts" --coverage.thresholds.perFile --coverage.thresholds.statements=80 --coverage.thresholds.branches=80 --coverage.thresholds.functions=80 --coverage.thresholds.lines=80
npm run lint
npm run build
npm audit
git check-ignore .env.local
git ls-files -- .env.local
git diff --check
git diff --stat feat/aws-migration-phase-1...HEAD
git status --short
```

Expected: **11 files / 110 tests** (baseline 37 + **73 new tests in 8 new files**); all four coverage measures ≥80% per new db/storage file; lint/build pass. Audit findings must be reviewed: do not expand this phase to unrelated dependency upgrades or claim a clean audit if baseline findings remain. `.env.local` is ignored/untracked, temporary source/test absent. Phase 2 commits contain only intended paths. Any outstanding infra working changes are preserved and excluded from Phase 2 commits; ensure the completed Region work is committed through Phase 1 and inherited before opening the PR.

- [ ] **Step 2: Review the implementation and existing-resource state**

Use code-reviewer and security-reviewer agents on the Phase 2 diff. Fix critical/high findings in the allowed modules/tests, rerun affected gates, and commit with explicit paths. Check that there are no credentials in the staged diff or branch diff, S3 failures alone are best-effort, category conditional failures are classified by action index, and ordinary database failures propagate. Do not add routes, page imports, deployment code, or IAM changes.

```powershell
$env:AWS_PROFILE = "cute-cookbook-project"; $env:AWS_REGION = "us-east-2"
aws lightsail get-container-services --region us-east-2 --query "containerServices[].containerServiceName"
aws iam list-access-keys --user-name cute-cookbook-deploy --query "length(AccessKeyMetadata)" --output text
gh run list --workflow "Vercel Deploy" --branch master --limit 1
```

Expected: no container (`[]`), zero deploy-user keys, existing Vercel production deployment unchanged by this branch. Verify the currently signed-in production recipe/favorites/category views still use the current data and permissions; no write smoke against production is required. The real-table script's base-table absence check is the cleanup evidence; do not demand immediate GSI disappearance.

- [ ] **Step 3: Push, open the PR, and watch checks**

Do not merge or deploy as part of this task. Review the full diff to `master` too: while Phase 1 is stacked, inherited Phase 1 commits can appear. The PR body must identify that dependency and the final review scope; after Phase 1 lands, recheck the diff without dropping its Region work.

```powershell
git diff --stat master...HEAD
git log --oneline master..HEAD
git push -u origin feat/aws-migration-phase-2
Set-Content -Path $env:TEMP\cute-cookbook-phase-2-pr.md -Value @"
## Phase 2: Data layer

- Adds server-side DynamoDB recipes/categories repositories, domain types, fail-fast config, keys, and typed errors.
- Recipe lists paginate GSI1 newest first, then filter favorites/categories; migration overrides preserve IDs and timestamps.
- Category names use atomic uniqueness items and guarded rename/delete transactions; delete removes recipe references.
- Adds validated five-minute S3 PUT signing, CloudFront URL resolution, and logged best-effort cover cleanup.
- Uses the existing cute-cookbook table, bucket, and d2gmo95al03pdi.cloudfront.net distribution in us-east-2, project 592685885054.
- Based on feat/aws-migration-phase-1 to retain the Region work; review inherited Phase 1 commits separately while stacked.
- Leaves Vercel + Supabase production and signed-in behavior unchanged. No routes, page swaps, CDK deploy, DNS, certificate, or container creation.

## Test plan

- Root npm test: 11 files / 110 tests (73 new); update these counts if review adds cases.
- Scoped per-file coverage on src/lib/db and src/lib/storage: statements, branches, functions, lines each at least 80%.
- npm run lint and npm run build pass; npm audit reviewed for introduced findings.
- Human real-table smoke as cute-cookbook-app: CREATE, bounded-poll LIST, DELETE, strong-read absence all passed; temporary source/test removed.
- .env.local ignored and untracked; deploy user still has no key; Lightsail container list remains empty.
- Phase 2 resume claim marked done only after the live smoke succeeded.

Dependencies: Phase 1 Region changes must be committed/inherited or merged before this PR is ready. No production cutover occurs here.
"@
gh pr create --base master --head feat/aws-migration-phase-2 --title "Phase 2: DynamoDB data layer and S3 helpers" --body-file $env:TEMP\cute-cookbook-phase-2-pr.md
gh pr checks --watch
```

Expected: PR to `master` exists; `CI / quality`, `CI / infra`, and Vercel preview checks pass. No app AWS secrets are needed by CI because tests mock clients and existing routes do not import the new config. If a code fix is needed, commit only its explicit paths, push, and repeat the checks. Attach the created PR to the Codex chat with the app's PR attachment tool when available.

---

## Phase 2 exit checklist

- [ ] Phase 2 branch is based on `feat/aws-migration-phase-1`; the `us-east-2` infra work is retained and committed through Phase 1, with no infra edits attributed to this implementation.
- [ ] `npm test` → **11 files / 110 tests**, including **8 new files / 73 new tests** (or documented higher counts after review).
- [ ] Scoped coverage command passes **≥80% statements, branches, functions, and lines per new file** under `src/lib/db` and `src/lib/storage`.
- [ ] Root `npm run lint` and `npm run build` pass; audit reviewed; PR checks green.
- [ ] Recipe tests prove GSI1 newest-first parameters, favorite/category filtering, all-page pagination, full/summary projections, override preservation, guarded updates/deletes, raw-key preservation, and logged best-effort S3 cleanup.
- [ ] Category tests prove list pagination, typed missing/conflict errors, transactional name uniqueness, case-only rename, atomic lock swaps, emoji updates, category/lock deletion, and recipe-reference cleanup.
- [ ] Presign tests prove only JPEG/PNG/WebP/HEIC, size ≤10 MiB, MIME-derived `covers/<uuid>.<ext>` key, five-minute expiry, and `https://` passthrough/CDN-prefix behavior. Gallery key shape remains reserved.
- [ ] The throwaway script ran against **existing** `cute-cookbook` in `us-east-2` as the app user: create/list/delete succeeded, a strong read proved its own item absent, and temporary source/test are removed.
- [ ] `.env.local` contains the six AWS variables, uses `IMAGE_CDN_HOST=d2gmo95al03pdi.cloudfront.net`, is gitignored, and is not tracked. Only the app user's access key was created; the deploy user still has zero keys.
- [ ] `aws lightsail get-container-services --region us-east-2 --query "containerServices[].containerServiceName"` → `[]`; no container or new infrastructure exists.
- [ ] No certificate/DNS/CDK work occurred; `CuteCookbookCertificates` remains undeployed; existing data stack/table/bucket/CDN are reused.
- [ ] Only the new Phase 2 resume bullet is marked `done`, backed by the successful real-table script; other planned phases remain planned.
- [ ] PR targets `master`; production still runs on Vercel + Supabase and signed-in behavior is unchanged.

Next: Phase 3 plan (authenticated API routes, route schemas, and typed error-to-status mapping).
