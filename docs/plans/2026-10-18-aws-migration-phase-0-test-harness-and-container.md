# AWS Migration — Phase 0: Test Harness & Container Image — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a unit-test runner, a health endpoint, and a production Docker image, all enforced in CI, without changing any user-visible behavior.

**Architecture:** Vitest runs colocated `*.test.ts` files under `src/` with the `@/` alias. Middleware path rules move into a pure, testable module (`src/lib/route-access.ts`) so the new `/api/health` bypass is covered by tests. `next.config.ts` switches to `output: "standalone"`, and a three-stage `Dockerfile` (deps → build → non-root runtime) produces the image Lightsail will run in Phase 6. CI gains `npm test` and a `docker build` smoke step.

**Tech Stack:** Next.js 16.1.6, React 19, TypeScript 5, Vitest (latest) + `@vitest/coverage-v8`, Docker (multi-stage, `node:22-alpine`), GitHub Actions.

**Spec:** `docs/plans/2026-10-18-aws-migration-design.md` §3 (`/api/health`), §4 (container image), §8 (test tooling).
**Roadmap:** `docs/plans/2026-10-18-aws-migration-roadmap.md` — Phase 0.

## Global Constraints

- Production still runs on Vercel + Supabase. Nothing in this phase may change runtime behavior for signed-in users.
- Node floor: 22 (Dockerfile base `node:22-alpine`; CI `node-version: 22`). Local Node 24 is fine.
- New runtime dependencies: none. New dev dependencies: `vitest`, `@vitest/coverage-v8` only; `@types/node` is bumped to `^22` to satisfy Vitest 5 peers and match the Node 22 floor.
- Tests are colocated: `src/**/*.test.ts`. Coverage target for new modules in this phase: 100% (they are tiny and pure).
- The `/api/health` bypass must be an exact match (`pathname === "/api/health"`), never `startsWith`.
- Secrets never enter the image. `.env*` is excluded by `.dockerignore`; env is injected at `docker run` / deploy time.
- Shell examples are PowerShell (the dev machine is Windows). On bash, replace `;` between commands with `&&`.
- Conventional commits: `feat:`, `test:`, `chore:`, `ci:`, `docs:`.

## Prerequisites

- [ ] **Commit the in-progress recruiter-role work.** `git status` currently shows 12 modified and 4 untracked files (recruiter role: `src/lib/auth-roles.ts`, `src/app/api/auth/session/`, `src/components/viewer-provider.tsx`, `src/styles/recruiter.css`, and edits to `src/middleware.ts`, `src/lib/auth-session.ts`, `src/lib/server-auth.ts`, several pages). This plan edits `src/middleware.ts` and tests `src/lib/auth-roles.ts`, so that work must land first:

```powershell
npm run lint
npm run build
git add -A
git commit -m "feat: recruiter read-only role with session roles and blocked paths"
git status --short
```

Expected: `git status --short` prints nothing.

- [ ] Docker Desktop is running (`docker --version` prints `Docker version 29.x`).
- [ ] `gh auth status` succeeds (used to watch CI).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `vitest.config.mts` | Create | Vitest runner config: node env, `src/**/*.test.ts`, `@/` alias, v8 coverage |
| `package.json` | Modify | `test`, `test:watch`, `test:coverage` scripts; dev deps |
| `eslint.config.mjs` | Modify | Ignore `coverage/**` |
| `src/lib/auth-roles.test.ts` | Create | First real test; proves alias + runner against an existing pure module |
| `src/lib/route-access.ts` | Create | Pure path predicates used by middleware (`isPublicPath`, `isBypassedPath`) incl. `/api/health` |
| `src/lib/route-access.test.ts` | Create | Tests for the predicates |
| `src/middleware.ts` | Modify | Import predicates from `route-access.ts` instead of defining them inline |
| `src/app/api/health/route.ts` | Create | `GET /api/health` → `200 { status: "ok" }`, `Cache-Control: no-store` |
| `src/app/api/health/route.test.ts` | Create | Tests for the handler |
| `next.config.ts` | Modify | `output: "standalone"` |
| `Dockerfile` | Create | Three-stage build; non-root runtime on port 3000 |
| `.dockerignore` | Create | Keep secrets, tooling, and docs out of the build context |
| `.github/workflows/ci.yml` | Modify | Node 22; add `npm test` and `docker build` steps |
| `docs/resume-highlights.md` | Modify | Add containerization bullet as `done` |

---

### Task 1: Vitest runner

**Files:**
- Create: `vitest.config.mts`
- Modify: `package.json` (scripts, devDependencies)
- Modify: `eslint.config.mjs:9-18`
- Test: `src/lib/auth-roles.test.ts`

**Interfaces:**
- Consumes: `src/lib/auth-roles.ts` — `roleForAccount(username: string): "owner" | "recruiter"`, `isRecruiterBlockedPath(pathname: string): boolean` (already exists).
- Produces: `npm test` (single run), `npm run test:watch`, `npm run test:coverage`. Later tasks and phases add `src/**/*.test.ts` files and they are picked up automatically.

- [ ] **Step 1: Install dev dependencies**

```powershell
npm install --save-dev @types/node@^22 vitest @vitest/coverage-v8
```

Expected: `package.json` `devDependencies` now lists `vitest` and `@vitest/coverage-v8`; `package-lock.json` updated. No peer-dependency errors.

- [ ] **Step 2: Add the config**

Create `vitest.config.mts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Add scripts**

In `package.json`, replace the `"scripts"` block with:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
```

- [ ] **Step 4: Ignore coverage output in ESLint**

In `eslint.config.mjs`, inside the `globalIgnores([...])` array, add `"coverage/**",` after `"next-env.d.ts",`:

```js
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    // Agent/tooling artifacts (not part of app source):
    ".claude/worktrees/**",
    ".claude/agents/**",
    ".cursor/**",
  ]),
```

(`/coverage` is already in `.gitignore`.)

- [ ] **Step 5: Write the first test (against existing code)**

Create `src/lib/auth-roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRecruiterBlockedPath, roleForAccount } from "@/lib/auth-roles";

describe("roleForAccount", () => {
  it("maps the recruiter account to the recruiter role", () => {
    expect(roleForAccount("recruiter")).toBe("recruiter");
  });

  it("maps every other account to owner", () => {
    expect(roleForAccount("gisellemyluv")).toBe("owner");
    expect(roleForAccount("test")).toBe("owner");
  });
});

describe("isRecruiterBlockedPath", () => {
  it.each([
    "/letter",
    "/letter/anything",
    "/birthday",
    "/birthday/scene-2",
    "/recipes/new",
    "/recipes/new/",
    "/recipes/abc-123/edit",
    "/recipes/abc-123/edit/",
  ])("blocks %s", (pathname) => {
    expect(isRecruiterBlockedPath(pathname)).toBe(true);
  });

  it.each(["/", "/recipes", "/recipes/abc-123", "/recipes/newer", "/favorites", "/settings"])(
    "allows %s",
    (pathname) => {
      expect(isRecruiterBlockedPath(pathname)).toBe(false);
    }
  );
});
```

- [ ] **Step 6: Run the suite**

```powershell
npm test
```

Expected: `Test Files 1 passed (1)`, `Tests 16 passed (16)` (2 plain `it` cases + 8 blocked + 6 allowed `it.each` cases). Exit code 0. If the `@/lib/auth-roles` import fails to resolve, the alias in `vitest.config.mts` is wrong — fix that before continuing.

- [ ] **Step 7: Confirm lint and build still pass**

```powershell
npm run lint
npm run build
```

Expected: both exit 0. `next build` type-checks `vitest.config.mts` and the test file; they must compile.

- [ ] **Step 8: Commit**

```powershell
git add vitest.config.mts package.json package-lock.json eslint.config.mjs src/lib/auth-roles.test.ts
git commit -m "test: add Vitest runner with coverage and first auth-roles tests"
```

---

### Task 2: Extract middleware path rules into a tested module (adds `/api/health` bypass)

**Files:**
- Create: `src/lib/route-access.ts`
- Test: `src/lib/route-access.test.ts`
- Modify: `src/middleware.ts:1-20` (remove inline predicates, import them)

**Interfaces:**
- Produces:
  - `isPublicPath(pathname: string): boolean` — true only for `/login`.
  - `isBypassedPath(pathname: string): boolean` — true for `/api/auth/*`, `/api/health` (exact), `/_next/*`, `/favicon*`, `/robots.txt`, `/sitemap.xml`. Phase 3 will add `/api/share/` here.
- Consumed by: `src/middleware.ts` now; Phase 3 route tests later.

- [ ] **Step 1: Write the failing test**

Create `src/lib/route-access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isBypassedPath, isPublicPath } from "@/lib/route-access";

describe("isPublicPath", () => {
  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it.each(["/", "/recipes", "/login/extra", "/api/recipes"])("treats %s as protected", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("isBypassedPath", () => {
  it.each([
    "/api/auth/login",
    "/api/auth/session",
    "/api/health",
    "/_next/static/chunk.js",
    "/_next/image?url=x",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
  ])("bypasses auth for %s", (pathname) => {
    expect(isBypassedPath(pathname)).toBe(true);
  });

  it.each(["/", "/recipes", "/api/recipes", "/api/healthz", "/api/health/extra", "/api/chat"])(
    "does not bypass auth for %s",
    (pathname) => {
      expect(isBypassedPath(pathname)).toBe(false);
    }
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npx vitest run src/lib/route-access.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/route-access"` (module does not exist yet).

- [ ] **Step 3: Create the module**

Create `src/lib/route-access.ts`:

```ts
const PUBLIC_ROUTES = new Set(["/login"]);

/** Pages reachable without a session. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

/** Paths the auth middleware must never touch (auth endpoints, health check, framework assets). */
export function isBypassedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
npx vitest run src/lib/route-access.test.ts
```

Expected: PASS, all cases green.

- [ ] **Step 5: Point middleware at the module**

Replace the top of `src/middleware.ts` (everything above `export async function middleware`) with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { isRecruiterBlockedPath } from "@/lib/auth-roles";
import { isBypassedPath, isPublicPath } from "@/lib/route-access";
```

Delete the inline `PUBLIC_ROUTES`, `isPublicPath`, and `isBypassedPath` definitions. The `middleware` function body and `config` export are unchanged. The resulting file:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { isRecruiterBlockedPath } from "@/lib/auth-roles";
import { isBypassedPath, isPublicPath } from "@/lib/route-access";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isBypassedPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  const session = token ? await verifySessionToken(token) : null;

  if (!session && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session?.role === "recruiter" && isRecruiterBlockedPath(pathname)) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  if (session && pathname === "/login") {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"],
};
```

- [ ] **Step 6: Full verification**

```powershell
npm test
npm run lint
npm run build
```

Expected: all exit 0; test summary shows 2 files passed.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/route-access.ts src/lib/route-access.test.ts src/middleware.ts
git commit -m "refactor: extract middleware path rules into tested route-access module"
```

---

### Task 3: `GET /api/health`

**Files:**
- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/health/route.test.ts`

**Interfaces:**
- Produces: `GET /api/health` → `200`, body `{ "status": "ok" }`, header `Cache-Control: no-store`. Used by Lightsail's health check (Phase 6) and the Docker smoke test (Task 4). Unauthenticated (bypassed in Task 2).

- [ ] **Step 1: Write the failing test**

Create `src/app/api/health/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 with an ok status", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("is never cached", () => {
    const response = GET();

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npx vitest run src/app/api/health/route.test.ts
```

Expected: FAIL — `Failed to resolve import "@/app/api/health/route"`.

- [ ] **Step 3: Create the route**

Create `src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
npx vitest run src/app/api/health/route.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Verify against the dev server without a session cookie**

Terminal 1:

```powershell
npm run dev
```

Terminal 2 (use `curl.exe`, not the PowerShell `curl` alias):

```powershell
curl.exe -i http://localhost:3000/api/health
```

Expected:

```
HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json
...
{"status":"ok"}
```

No `307` redirect to `/login` (that would mean the bypass from Task 2 isn't active). Stop the dev server (`Ctrl+C`).

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/health/route.ts src/app/api/health/route.test.ts
git commit -m "feat: add unauthenticated GET /api/health endpoint"
```

---

### Task 4: Standalone build and Docker image

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `docs/resume-highlights.md`

**Interfaces:**
- Produces: image `cute-cookbook:<tag>` listening on `0.0.0.0:3000`, started with `node server.js`, running as non-root `nextjs`. Phase 6's workflow builds this exact Dockerfile. Runtime env is injected at run time; required in production: `AUTH_SESSION_SECRET`, `AUTH_PASSWORD_GISELLEMYLUV`, `AUTH_PASSWORD_TEST`, `AUTH_PASSWORD_RECRUITER` (the auth modules throw in `NODE_ENV=production` without them).

- [ ] **Step 1: Enable standalone output**

Replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mzcjisblrdzgmdqrrpzi.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify the standalone server is emitted**

```powershell
npm run build
Test-Path .next/standalone/server.js
```

Expected: build exits 0 and `Test-Path` prints `True`.

- [ ] **Step 3: Create `.dockerignore`**

```
# dependencies / build output (rebuilt inside the image)
node_modules
.next
coverage
tsconfig.tsbuildinfo

# secrets — never in the build context
.env
.env.*

# VCS, CI, hosting metadata
.git
.github
.vercel

# IDE and agent tooling
.idea
.claude
.cursor
.codex
.agents
agents

# docs and plans
docs
*.md

# tests and test config are not needed to build the app
vitest.config.mts
**/*.test.ts

# future phases (not part of the app image)
infra
scripts
supabase
```

- [ ] **Step 4: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ---- deps: install exactly what package-lock.json says ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js app to standalone output ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal, non-root runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

Notes for the implementer:
- `libc6-compat` is needed on Alpine for `sharp` (used by `next/image`). `npm ci` installs the `linuxmusl-x64` sharp binary automatically.
- `.next/standalone` already contains a pruned `node_modules` and `server.js`; do **not** copy the full `node_modules` into the runner.
- `NEXT_PUBLIC_SUPABASE_*` is not present at image build time, so `src/lib/supabase.ts` falls back to its placeholder client. Data pages will not load data inside this container until Phase 4 replaces Supabase. That is expected; this phase verifies health and auth only.

- [ ] **Step 5: Build the image**

```powershell
docker build -t cute-cookbook:local .
```

Expected: ends with `naming to docker.io/library/cute-cookbook:local`. Build takes 2–5 minutes the first time. If the build fails in the `builder` stage with a TypeScript error about a missing test file or `vitest`, the `.dockerignore` is excluding something `tsconfig.json` includes — this is fine for `**/*.test.ts` (TS ignores missing files), but confirm `vitest.config.mts` isn't imported anywhere in `src/`.

- [ ] **Step 6: Run and smoke-test the container**

Terminal 1:

```powershell
docker run --rm -p 3000:3000 `
  -e AUTH_SESSION_SECRET=local-only-not-a-real-secret `
  -e AUTH_PASSWORD_GISELLEMYLUV=00000000 `
  -e AUTH_PASSWORD_TEST=test `
  -e AUTH_PASSWORD_RECRUITER=recruiter `
  --name cute-cookbook-smoke cute-cookbook:local
```

Expected log line: `▲ Next.js 16.1.6` then `- Local: http://0.0.0.0:3000` and `✓ Ready in ...ms`.

Terminal 2:

```powershell
curl.exe -i http://localhost:3000/api/health
```

Expected: `HTTP/1.1 200 OK`, `{"status":"ok"}`.

```powershell
curl.exe -i http://localhost:3000/
```

Expected: `HTTP/1.1 307 Temporary Redirect` with `location: /login` (middleware is running inside the image).

```powershell
Set-Content -Path $env:TEMP\login.json -Value '{"username":"test","password":"test"}'
curl.exe -i -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" --data "@$env:TEMP\login.json"
```

Expected: `HTTP/1.1 200 OK`, a `set-cookie:` header, body `{"ok":true}` (the server-side auth stack works with injected env).

```powershell
docker exec cute-cookbook-smoke id
```

Expected: `uid=1001(nextjs) gid=1001(nodejs)` — the process is non-root.

Stop the container: `Ctrl+C` in Terminal 1 (the `--rm` flag removes it).

- [ ] **Step 7: Record the resume bullet**

In `docs/resume-highlights.md`, add this line to the end of the `## Bullet points` list:

```markdown
- `done` Containerized a Next.js 16 app with a three-stage Docker build (pinned `npm ci` deps, standalone output, non-root Alpine runtime, health endpoint), keeping secrets out of the image via `.dockerignore` and runtime env injection.
```

- [ ] **Step 8: Verify nothing else regressed**

```powershell
npm test
npm run lint
```

Expected: both exit 0.

- [ ] **Step 9: Commit**

```powershell
git add next.config.ts Dockerfile .dockerignore docs/resume-highlights.md
git commit -m "chore: standalone Next.js output and multi-stage production Dockerfile"
```

---

### Task 5: CI — Node 22, tests, image build

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: the `CI / quality` check runs lint → test → build → `docker build` on every PR and push to `main`/`master`. Phase 6 adds a separate `deploy.yml`; `ci.yml` stays the PR gate.

- [ ] **Step 1: Update the workflow**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main
      - master

jobs:
  quality:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Build container image
        run: docker build -t cute-cookbook:ci .
```

- [ ] **Step 2: Commit and push**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: run tests and docker build on Node 22"
git push
```

- [ ] **Step 3: Watch the run**

```powershell
gh run watch
```

(Select the most recent `CI` run if prompted.) Expected: all five steps green, job `quality` succeeds. The `Build container image` step should take 2–4 minutes on the hosted runner.

If `Build container image` fails but the local build passed, compare the runner's log for the `builder` stage with the local output — the usual cause is a file present locally but excluded by `.dockerignore` that the build actually needs; fix `.dockerignore`, rebuild locally, recommit.

---

## Phase 0 exit checklist

- [ ] `npm test` passes locally and in CI (3 test files: `auth-roles`, `route-access`, `health/route`).
- [ ] `curl.exe -i http://localhost:3000/api/health` returns `200 {"status":"ok"}` from both `npm run dev` and the Docker container, with no login redirect.
- [ ] `docker run` of `cute-cookbook:local` serves `/login` and accepts a test login via `/api/auth/login`, running as uid 1001.
- [ ] CI `quality` job is green on `master` with lint, test, build, and image build.
- [ ] `docs/resume-highlights.md` has the containerization bullet marked `done`.
- [ ] Production on Vercel is unchanged (Vercel ignores `output: "standalone"` and the Dockerfile; `vercel-deploy.yml` still runs on push — confirm the Vercel deployment also succeeded with `gh run list --workflow "Vercel Deploy" --limit 1`).

## Execution notes (2026-10-19)

Executed on branch `feat/aws-migration-phase-0` (PR #1), commits `63a0da9..e8522aa`. Deviations approved during execution and reflected above:
- `vitest.config.mts` instead of `.ts` (silences Vite's ESM loader warning; test output pristine).
- `@types/node` bumped to `^22` (Vitest 5 peer requirement; matches Node 22 floor).
- `adduser --ingroup nodejs` so the runtime user's gid is `1001(nodejs)` as the smoke test expects.
- Login smoke test sends the JSON body from a file (PowerShell 5.1 mangles inline escaped quotes).
- Container smoke test ran on host port 3100 because a dev server occupied 3000.

Deferred findings from the whole-branch review, to pick up in later phases:
- Phase 6 `deploy.yml`: explicit `permissions:`, `concurrency` group, buildx + GHA layer cache; Lightsail health-check path `/api/health`; retiring `vercel-deploy.yml` also removes its Node 20 runner.
- Phase 3 (when editing `route-access.ts`): make `robots.txt` / `sitemap.xml` exact matches; add the `/api/auth` no-trailing-slash test.
- Separate chores: pre-existing `npm audit` findings; Next 16 `middleware.ts` → `proxy.ts` rename; remove the `.env` file-reading fallback in `scrape-recipe/route.ts` (it makes Next trace `src/` into the standalone output); point `npm start` at `node .next/standalone/server.js` if anyone uses it locally.

Next: Phase 1 plan (`infra/` CDK stacks).


