# Resume Highlights — AWS Migration

Running log of resume-worthy work from migrating Cute Cookbook off Vercel + Supabase onto AWS.
Status tags: `planned` (designed, not yet built), `done` (shipped and verified).

Update this file whenever a decision or implementation adds something worth saying in an interview.

## Bullet points

- `planned` Migrated a production Next.js 16 app from Vercel + Supabase to AWS (Lightsail Container Service, DynamoDB, S3, CloudFront), defining all infrastructure with AWS CDK in TypeScript.
- `planned` Designed a DynamoDB single-table model (generic PK/SK + one GSI) replacing a 6-table relational schema; denormalized tags/photos/categories into recipe items and enforced category-name uniqueness with transactional companion items.
- `planned` Eliminated client-side database access: replaced ~20 browser-side Supabase calls with authenticated Next.js Route Handlers over a repository layer, closing a gap where a read-only role could write via a public anon key.
- `planned` Built a secure image pipeline: private S3 bucket behind CloudFront with Origin Access Control, browser uploads via short-lived presigned PUT URLs with server-side content-type and size validation.
- `planned` Applied least-privilege IAM: application credentials scoped to a single DynamoDB table/index and a single S3 bucket's object operations.
- `planned` Wrote an idempotent one-shot migration script moving live Postgres rows and Supabase Storage objects to DynamoDB and S3 while preserving public share-link IDs.
- `planned` Operated within a fixed $200/12-month AWS credit budget by choosing always-free services (DynamoDB on-demand, CloudFront) and right-sizing compute (~$10/mo).
- `done` Containerized a Next.js 16 app with a three-stage Docker build (pinned `npm ci` deps, standalone output, non-root Alpine runtime, health endpoint), keeping secrets out of the image via `.dockerignore` and runtime env injection.

## Talking points / stories

- Why DynamoDB over RDS: RDS alone (~$14/mo) would have exhausted the credit budget in ~10 months; DynamoDB on-demand stays in the always-free tier, at the cost of a data-model rewrite.
- Why Lightsail Containers over a VM: managed HTTPS, custom-domain certs, and rolling deploys without owning Nginx/systemd; deploy is `docker build` → push → `create-container-service-deployment`.
- Trade-off accepted: list/favorite/category filtering is done in the repository on a single GSI query rather than with sparse indexes — correct at single-user scale, with a clear path to add indexes if it ever matters.
- Deliberately deferred: converting pages to React Server Components + Server Actions (tracked as follow-up) to keep the AWS migration's blast radius small on a polished mobile UI.
