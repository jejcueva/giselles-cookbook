# AWS Migration — Phase 1: Infrastructure (CDK) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1–4 are code and are subagent-executable. Task 5 deploys to the user's real AWS account and requires console + DNS access; it is a guided manual task for the human.

**Goal:** Define every AWS resource the app needs in CDK (TypeScript), prove it with assertion tests in CI, and deploy it to `us-east-1` so later phases have a real table, bucket, CDN, and credentials to develop against — without yet paying for compute.

**Architecture:** A standalone `infra/` npm package with three stacks deployed in order: `CuteCookbookCertificates` (ACM cert for `img.cutecookbook.com` + Lightsail cert for the site — isolated because manual DNS validation blocks a stack), `CuteCookbookData` (DynamoDB single table, private S3 bucket, CloudFront with Origin Access Control, least-privilege app IAM user), and `CuteCookbookCompute` (deploy IAM user; the Lightsail container service is gated behind a context flag and not created until Phase 6 because Lightsail bills it from creation). Shared constants live in one `config.ts`.

**Tech Stack:** aws-cdk-lib ^2.273, constructs ^10.4, aws-cdk CLI ^2.1145, TypeScript 5, tsx, Vitest 5, AWS CLI v2.

**Spec:** `docs/plans/2026-10-18-aws-migration-design.md` §1 (table), §2 (bucket/CDN/IAM), §4 (stacks), §5 (deploy user).
**Roadmap:** `docs/plans/2026-10-18-aws-migration-roadmap.md` — Phase 1.

## Global Constraints

- Region for everything: `us-east-1`.
- Budget: $200 credit over 12 months. **No Lightsail container service is created in this phase** (it bills ~$10/mo from creation). Every resource created here is in an always-free or sub-$0.10/mo tier: DynamoDB on-demand, S3 (tiny), CloudFront (1 TB/mo free), ACM/Lightsail certificates (free), IAM (free), CDK bootstrap bucket (pennies).
- DynamoDB: table name `cute-cookbook`; keys `PK`/`SK` (string); GSI `GSI1` on `GSI1PK`/`GSI1SK` (string), projection `ALL`; billing `PAY_PER_REQUEST`; point-in-time recovery enabled; `RemovalPolicy.RETAIN`.
- S3: private, `BlockPublicAccess.BLOCK_ALL`, SSL enforced, versioning off, lifecycle rule aborting incomplete multipart uploads after 1 day, CORS `PUT` from `https://cutecookbook.com`, `https://www.cutecookbook.com`, `http://localhost:3000`; `RemovalPolicy.RETAIN`.
- CloudFront: S3 origin via Origin Access Control, viewer protocol `HTTPS_ONLY`, `GET`/`HEAD` only, domain `img.cutecookbook.com`, price class 100.
- App IAM user `cute-cookbook-app`: inline policy with exactly `dynamodb:GetItem, PutItem, UpdateItem, DeleteItem, Query, BatchGetItem, BatchWriteItem, TransactWriteItems, ConditionCheckItem` on the table ARN and `<tableArn>/index/*`, and `s3:PutObject, GetObject, DeleteObject` on `<bucketArn>/*`. Nothing on `Resource: "*"`.
- Deploy IAM user `cute-cookbook-deploy`: inline policy with exactly `lightsail:CreateContainerServiceRegistryLogin, RegisterContainerImage, CreateContainerServiceDeployment, GetContainerServices, GetContainerServiceDeployments, GetContainerImages` on `*` (Lightsail has no resource-level scoping for these).
- Lightsail certificate name `cute-cookbook-site`, domains `cutecookbook.com` + `www.cutecookbook.com`. Container service (Phase 6 only) name `cute-cookbook`, power `micro`, scale `1`.
- No secrets in the repo. Access keys go to `.env.local` (git-ignored) now and GitHub Secrets later. CloudFormation outputs never contain secrets.
- `infra/` must not be type-checked or linted by the root Next.js toolchain (root `tsconfig.json` excludes it; root ESLint ignores it; `.dockerignore` already excludes it).
- Tests: `infra/test/*.test.ts` with CDK `Template` assertions; every constraint above that is expressible in a template has an assertion.
- Shell examples are PowerShell. Commands under `infra/` assume `cd infra` first.
- Conventional commits: `feat:`, `test:`, `chore:`, `ci:`, `docs:`.

## Prerequisites (human)

- [ ] **Merge PR #1** (Phase 0) into `master`, confirm `CI / quality` and `Vercel Deploy / deploy-production` are green on `master`, then branch: `git checkout master; git pull; git checkout -b feat/aws-migration-phase-1`. (If you prefer not to merge yet, branch from `feat/aws-migration-phase-0` instead; Task 4 edits `ci.yml`, which Phase 0 also touched, so stacking avoids a conflict.)
- [ ] **AWS account plan.** In the AWS console → Billing → *Free Tier*, confirm you are on the **Paid plan** (credits valid 12 months). On the Free plan, unused credits expire at 6 months; upgrading does not charge you until credits are exhausted.
- [ ] **Install AWS CLI v2:** `winget install --id Amazon.AWSCLI -e`, then open a new terminal and confirm `aws --version` prints `aws-cli/2.x`.
- [ ] **Create an admin identity for CDK** (never use root keys). Console → IAM → Users → *Create user* `cute-cookbook-admin` → attach policy `AdministratorAccess` → create an access key (use case: CLI). Then:

```powershell
aws configure --profile cute-cookbook
# paste the key id and secret; region: us-east-1; output: json
$env:AWS_PROFILE = "cute-cookbook"
aws sts get-caller-identity
```

Expected: JSON with your `Account` id and `Arn` ending in `user/cute-cookbook-admin`. Note the 12-digit account id; Task 5 needs it. Set `$env:AWS_PROFILE = "cute-cookbook"` in every new terminal you run `cdk` or `aws` from (or add it to your PowerShell profile).

- [ ] **DNS access.** You can add CNAME records for `cutecookbook.com` at whichever provider currently hosts its DNS. Task 5 adds four CNAMEs (ACM validation, two Lightsail validations, `img`). None of them affect the live Vercel site.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `infra/package.json` | Create | Standalone package: CDK, tsx, Vitest, scripts |
| `infra/tsconfig.json` | Create | Type-check config for `bin`, `lib`, `test` |
| `infra/cdk.json` | Create | CDK app entrypoint + default context (`containerService: "false"`) |
| `infra/vitest.config.mts` | Create | Test runner config |
| `infra/.gitignore` | Create | `node_modules`, `cdk.out`, `coverage` |
| `infra/lib/config.ts` | Create | Single source of truth for names, domains, region, sizes |
| `infra/lib/certificates-stack.ts` | Create | ACM cert (img) + Lightsail cert (site) |
| `infra/lib/data-stack.ts` | Create | Table, bucket, CDN, app user + policy, outputs |
| `infra/lib/compute-stack.ts` | Create | Deploy user + policy; gated Lightsail container service |
| `infra/bin/app.ts` | Create | Instantiates the three stacks in `us-east-1` |
| `infra/test/config.test.ts` | Create | Name/domain constraints |
| `infra/test/certificates-stack.test.ts` | Create | Certificate assertions |
| `infra/test/data-stack.test.ts` | Create | Table/bucket/CDN/IAM assertions |
| `infra/test/compute-stack.test.ts` | Create | Deploy policy + gating assertions |
| `tsconfig.json` (root) | Modify | Exclude `infra` |
| `eslint.config.mjs` (root) | Modify | Ignore `infra/**` |
| `.github/workflows/ci.yml` | Modify | Add `infra` job: typecheck, test, synth |
| `docs/resume-highlights.md` | Modify | IaC + least-privilege bullets → `done` after Task 5 |

---

### Task 1: Infra package scaffold, config, and certificates stack

**Files:**
- Create: `infra/package.json`, `infra/tsconfig.json`, `infra/cdk.json`, `infra/vitest.config.mts`, `infra/.gitignore`
- Create: `infra/lib/config.ts`, `infra/lib/certificates-stack.ts`, `infra/bin/app.ts`
- Modify: `tsconfig.json` (root) `exclude`; `eslint.config.mjs` (root) `globalIgnores`
- Test: `infra/test/config.test.ts`, `infra/test/certificates-stack.test.ts`

**Interfaces:**
- Produces `infra/lib/config.ts`:
  ```ts
  export const config = {
    region: "us-east-1",
    rootDomain: "cutecookbook.com",
    wwwDomain: "www.cutecookbook.com",
    imageDomain: "img.cutecookbook.com",
    tableName: "cute-cookbook",
    gsi1Name: "GSI1",
    appUserName: "cute-cookbook-app",
    deployUserName: "cute-cookbook-deploy",
    siteCertificateName: "cute-cookbook-site",
    containerServiceName: "cute-cookbook",
    containerPower: "micro",
    containerScale: 1,
    corsOrigins: ["https://cutecookbook.com", "https://www.cutecookbook.com", "http://localhost:3000"],
  } as const;
  ```
- Produces `CertificatesStack` with public readonly `imageCertificate: acm.ICertificate` and `siteCertificateName: string` (consumed by Tasks 2 and 3).
- Produces `npm test`, `npm run typecheck`, `npm run synth` inside `infra/`.

- [ ] **Step 1: Scaffold the package**

Create `infra/package.json`:

```json
{
  "name": "cute-cookbook-infra",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "synth": "cdk synth --quiet",
    "diff": "cdk diff",
    "deploy": "cdk deploy"
  },
  "devDependencies": {
    "@types/node": "^22",
    "aws-cdk": "^2.1145.0",
    "aws-cdk-lib": "^2.273.0",
    "constructs": "^10.4.0",
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^5"
  }
}
```

Create `infra/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["bin", "lib", "test", "vitest.config.mts"]
}
```

Create `infra/cdk.json`:

```json
{
  "app": "npx tsx bin/app.ts",
  "context": {
    "containerService": "false"
  }
}
```

Create `infra/vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
```

(CDK synthesis in tests takes a few seconds per stack; the 30 s timeout avoids flakes on a cold machine.)

Create `infra/.gitignore`:

```
node_modules
cdk.out
coverage
```

- [ ] **Step 2: Install**

```powershell
cd infra
npm install
```

Expected: `package-lock.json` created; no `ERESOLVE` errors. If `npm install` reports a peer conflict between `aws-cdk-lib` and `constructs`, run `npm view aws-cdk-lib peerDependencies` and set `constructs` to the printed range.

- [ ] **Step 3: Keep the root toolchain out of `infra/`**

In the root `tsconfig.json`, change the last line:

```json
  "exclude": ["node_modules", "infra"]
```

In the root `eslint.config.mjs`, inside `globalIgnores([...])`, add after `"coverage/**",`:

```js
    "infra/**",
```

Verify from the repo root:

```powershell
cd ..
npm run lint
npm run build
```

Expected: both exit 0 (root build must not try to compile `infra/**/*.ts`, which import `aws-cdk-lib` the root cannot resolve).

- [ ] **Step 4: Write the failing config test**

Create `infra/test/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { config } from "../lib/config";

// Lightsail container service / certificate names: lowercase alphanumerics and hyphens,
// must start and end with an alphanumeric, 1-63 chars.
const LIGHTSAIL_NAME = /^(?:[a-z0-9]{1,2}|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/;
// DynamoDB table names: 3-255 chars of [a-zA-Z0-9_.-].
const DYNAMO_TABLE_NAME = /^[a-zA-Z0-9_.-]{3,255}$/;
// IAM user names: 1-64 chars of [\w+=,.@-].
const IAM_USER_NAME = /^[\w+=,.@-]{1,64}$/;

describe("infra config", () => {
  it("targets us-east-1 (required for CloudFront certificates)", () => {
    expect(config.region).toBe("us-east-1");
  });

  it("uses Lightsail-legal names for the container service and certificate", () => {
    expect(config.containerServiceName).toMatch(LIGHTSAIL_NAME);
    expect(config.siteCertificateName).toMatch(LIGHTSAIL_NAME);
  });

  it("uses a legal DynamoDB table name and IAM user names", () => {
    expect(config.tableName).toMatch(DYNAMO_TABLE_NAME);
    expect(config.appUserName).toMatch(IAM_USER_NAME);
    expect(config.deployUserName).toMatch(IAM_USER_NAME);
    expect(config.appUserName).not.toBe(config.deployUserName);
  });

  it("derives all domains from the root domain", () => {
    expect(config.wwwDomain).toBe(`www.${config.rootDomain}`);
    expect(config.imageDomain).toBe(`img.${config.rootDomain}`);
  });

  it("allows presigned uploads only from the site and local dev", () => {
    expect(config.corsOrigins).toEqual([
      `https://${config.rootDomain}`,
      `https://${config.wwwDomain}`,
      "http://localhost:3000",
    ]);
  });

  it("sizes compute to the budget tier", () => {
    expect(config.containerPower).toBe("micro");
    expect(config.containerScale).toBe(1);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

```powershell
cd infra
npx vitest run test/config.test.ts
```

Expected: FAIL — `Cannot find module '../lib/config'` (or equivalent "Failed to load" error).

- [ ] **Step 6: Create the config module**

Create `infra/lib/config.ts`:

```ts
/** Single source of truth for names, domains, and sizes used across all stacks. */
export const config = {
  region: "us-east-1",

  rootDomain: "cutecookbook.com",
  wwwDomain: "www.cutecookbook.com",
  imageDomain: "img.cutecookbook.com",

  tableName: "cute-cookbook",
  gsi1Name: "GSI1",

  appUserName: "cute-cookbook-app",
  deployUserName: "cute-cookbook-deploy",

  siteCertificateName: "cute-cookbook-site",
  containerServiceName: "cute-cookbook",
  containerPower: "micro",
  containerScale: 1,

  corsOrigins: ["https://cutecookbook.com", "https://www.cutecookbook.com", "http://localhost:3000"],
} as const;
```

- [ ] **Step 7: Run the config test to verify it passes**

```powershell
npx vitest run test/config.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 8: Write the failing certificates-stack test**

Create `infra/test/certificates-stack.test.ts`:

```ts
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CertificatesStack } from "../lib/certificates-stack";
import { config } from "../lib/config";

const env = { account: "123456789012", region: "us-east-1" };

function synth() {
  const app = new App();
  const stack = new CertificatesStack(app, "Certs", { env });
  return { stack, template: Template.fromStack(stack) };
}

describe("CertificatesStack", () => {
  it("requests a DNS-validated ACM certificate for the image CDN domain", () => {
    const { template } = synth();
    template.resourceCountIs("AWS::CertificateManager::Certificate", 1);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: config.imageDomain,
      ValidationMethod: "DNS",
    });
  });

  it("requests a Lightsail certificate covering the apex and www", () => {
    const { template } = synth();
    template.resourceCountIs("AWS::Lightsail::Certificate", 1);
    template.hasResourceProperties("AWS::Lightsail::Certificate", {
      CertificateName: config.siteCertificateName,
      DomainName: config.rootDomain,
      SubjectAlternativeNames: [config.wwwDomain],
    });
  });

  it("exposes the certificate identifiers to other stacks", () => {
    const { stack, template } = synth();
    expect(stack.siteCertificateName).toBe(config.siteCertificateName);
    template.hasOutput("ImageCertificateArn", {});
    template.hasOutput("SiteCertificateName", { Value: config.siteCertificateName });
  });

  it("creates nothing that costs money", () => {
    const { template } = synth();
    const resources = template.toJSON().Resources as Record<string, { Type: string }>;
    const types = new Set(Object.values(resources).map((r) => r.Type));
    expect([...types].sort()).toEqual([
      "AWS::CertificateManager::Certificate",
      "AWS::Lightsail::Certificate",
    ]);
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

```powershell
npx vitest run test/certificates-stack.test.ts
```

Expected: FAIL — cannot find module `../lib/certificates-stack`.

- [ ] **Step 10: Create the certificates stack**

Create `infra/lib/certificates-stack.ts`:

```ts
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as lightsail from "aws-cdk-lib/aws-lightsail";
import type { Construct } from "constructs";
import { config } from "./config";

/**
 * Certificates are isolated in their own stack: ACM DNS validation without Route 53
 * holds the stack in CREATE_IN_PROGRESS until the CNAME is added manually, and the
 * Lightsail certificate must be issued before it can be attached to a container service.
 */
export class CertificatesStack extends cdk.Stack {
  readonly imageCertificate: acm.ICertificate;
  readonly siteCertificateName: string;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.imageCertificate = new acm.Certificate(this, "ImageCertificate", {
      domainName: config.imageDomain,
      validation: acm.CertificateValidation.fromDns(),
    });

    const siteCertificate = new lightsail.CfnCertificate(this, "SiteCertificate", {
      certificateName: config.siteCertificateName,
      domainName: config.rootDomain,
      subjectAlternativeNames: [config.wwwDomain],
    });
    this.siteCertificateName = siteCertificate.certificateName;

    new cdk.CfnOutput(this, "ImageCertificateArn", {
      value: this.imageCertificate.certificateArn,
      description: "ACM certificate for img.cutecookbook.com (used by CloudFront)",
    });
    new cdk.CfnOutput(this, "SiteCertificateName", {
      value: siteCertificate.certificateName,
      description: "Lightsail certificate to attach to the container service in Phase 6",
    });
  }
}
```

- [ ] **Step 11: Create the app entrypoint (certificates only for now)**

Create `infra/bin/app.ts`:

```ts
import * as cdk from "aws-cdk-lib";
import { CertificatesStack } from "../lib/certificates-stack";
import { config } from "../lib/config";

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region };

new CertificatesStack(app, "CuteCookbookCertificates", { env });
```

- [ ] **Step 12: Verify tests, typecheck, and synth**

```powershell
npx vitest run
npm run typecheck
npm run synth
Get-ChildItem cdk.out -Filter "*.template.json" | Select-Object Name
```

Expected: `Test Files 2 passed (2)`, `Tests 10 passed (10)`; typecheck exit 0; synth exit 0; `CuteCookbookCertificates.template.json` listed. (Synth needs no AWS credentials: with `CDK_DEFAULT_ACCOUNT` unset the stack is environment-agnostic.)

- [ ] **Step 13: Commit**

```powershell
cd ..
git add infra/package.json infra/package-lock.json infra/tsconfig.json infra/cdk.json infra/vitest.config.mts infra/.gitignore infra/lib/config.ts infra/lib/certificates-stack.ts infra/bin/app.ts infra/test/config.test.ts infra/test/certificates-stack.test.ts tsconfig.json eslint.config.mjs
git commit -m "feat(infra): scaffold CDK package with config and certificates stack"
```

---

### Task 2: Data stack — DynamoDB table, S3 bucket, CloudFront, app IAM user

**Files:**
- Create: `infra/lib/data-stack.ts`
- Modify: `infra/bin/app.ts`
- Test: `infra/test/data-stack.test.ts`

**Interfaces:**
- Consumes: `CertificatesStack.imageCertificate: acm.ICertificate`; `config` from Task 1.
- Produces: `DataStack` with props `{ imageCertificate: acm.ICertificate }` and public readonly `table: dynamodb.Table`, `bucket: s3.Bucket`, `distribution: cloudfront.Distribution`, `appUser: iam.User`. Outputs `TableName`, `BucketName`, `ImageCdnDomainName`, `AppUserName`.

- [ ] **Step 1: Write the failing test**

Create `infra/test/data-stack.test.ts`:

```ts
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CertificatesStack } from "../lib/certificates-stack";
import { config } from "../lib/config";
import { DataStack } from "../lib/data-stack";

const env = { account: "123456789012", region: "us-east-1" };

function synth() {
  const app = new App();
  const certs = new CertificatesStack(app, "Certs", { env });
  const stack = new DataStack(app, "Data", { env, imageCertificate: certs.imageCertificate });
  return { stack, template: Template.fromStack(stack) };
}

type Statement = { Effect: string; Action: string | string[]; Resource: unknown };

function appPolicyStatements(template: Template): Statement[] {
  const policies = template.findResources("AWS::IAM::Policy");
  const statements = Object.values(policies).flatMap(
    (p) => (p.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement
  );
  return statements;
}

describe("DataStack DynamoDB table", () => {
  it("defines the single table with PK/SK and GSI1, on-demand, PITR, retained", () => {
    const { template } = synth();
    template.resourceCountIs("AWS::DynamoDB::Table", 1);
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: config.tableName,
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      AttributeDefinitions: Match.arrayWith([
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
        { AttributeName: "GSI1PK", AttributeType: "S" },
        { AttributeName: "GSI1SK", AttributeType: "S" },
      ]),
      GlobalSecondaryIndexes: [
        {
          IndexName: config.gsi1Name,
          KeySchema: [
            { AttributeName: "GSI1PK", KeyType: "HASH" },
            { AttributeName: "GSI1SK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
    template.hasResource("AWS::DynamoDB::Table", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });
});

describe("DataStack S3 bucket", () => {
  it("is private, SSL-only, retained, with multipart cleanup and upload CORS", () => {
    const { template } = synth();
    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      LifecycleConfiguration: {
        Rules: [Match.objectLike({ AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 }, Status: "Enabled" })],
      },
      CorsConfiguration: {
        CorsRules: [
          Match.objectLike({
            AllowedMethods: ["PUT"],
            AllowedOrigins: [...config.corsOrigins],
            AllowedHeaders: ["*"],
          }),
        ],
      },
    });
    template.hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
    // enforceSSL adds a Deny statement for aws:SecureTransport=false
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Deny",
            Action: "s3:*",
            Condition: { Bool: { "aws:SecureTransport": "false" } },
          }),
        ]),
      },
    });
  });

  it("does not enable versioning", () => {
    const { template } = synth();
    const buckets = template.findResources("AWS::S3::Bucket");
    const props = Object.values(buckets)[0].Properties as Record<string, unknown>;
    expect(props.VersioningConfiguration).toBeUndefined();
  });
});

describe("DataStack CloudFront", () => {
  it("fronts the bucket through Origin Access Control over HTTPS only", () => {
    const { template } = synth();
    template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Enabled: true,
        Aliases: [config.imageDomain],
        PriceClass: "PriceClass_100",
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "https-only",
          AllowedMethods: ["GET", "HEAD"],
        }),
        Origins: [
          Match.objectLike({
            OriginAccessControlId: Match.anyValue(),
            S3OriginConfig: Match.objectLike({ OriginAccessIdentity: "" }),
          }),
        ],
        ViewerCertificate: Match.objectLike({
          AcmCertificateArn: Match.anyValue(),
          SslSupportMethod: "sni-only",
        }),
      }),
    });
  });

  it("grants CloudFront read access to the bucket via the distribution ARN condition", () => {
    const { template } = synth();
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Allow",
            Action: "s3:GetObject",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Condition: { StringEquals: { "AWS:SourceArn": Match.anyValue() } },
          }),
        ]),
      },
    });
  });
});

describe("DataStack app IAM user", () => {
  it("creates exactly one user with the configured name and no managed policies", () => {
    const { template } = synth();
    template.resourceCountIs("AWS::IAM::User", 1);
    template.hasResourceProperties("AWS::IAM::User", { UserName: config.appUserName });
    const users = template.findResources("AWS::IAM::User");
    const props = Object.values(users)[0].Properties as Record<string, unknown>;
    expect(props.ManagedPolicyArns).toBeUndefined();
  });

  it("scopes DynamoDB access to the item/query actions on the table and its indexes", () => {
    const { template } = synth();
    const statement = appPolicyStatements(template).find((s) =>
      (Array.isArray(s.Action) ? s.Action : [s.Action]).some((a) => a.startsWith("dynamodb:"))
    );
    expect(statement).toBeDefined();
    expect([...(statement!.Action as string[])].sort()).toEqual(
      [
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:ConditionCheckItem",
        "dynamodb:DeleteItem",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:TransactWriteItems",
        "dynamodb:UpdateItem",
      ].sort()
    );
    // Two resources: the table ARN and <tableArn>/index/*
    expect(Array.isArray(statement!.Resource)).toBe(true);
    expect((statement!.Resource as unknown[]).length).toBe(2);
    expect(JSON.stringify(statement!.Resource)).toContain("/index/*");
  });

  it("scopes S3 access to object get/put/delete on the one bucket", () => {
    const { template } = synth();
    const statement = appPolicyStatements(template).find((s) =>
      (Array.isArray(s.Action) ? s.Action : [s.Action]).some((a) => a.startsWith("s3:"))
    );
    expect(statement).toBeDefined();
    expect([...(statement!.Action as string[])].sort()).toEqual(
      ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"].sort()
    );
    expect(JSON.stringify(statement!.Resource)).toContain('"/*"');
  });

  it("never grants on Resource *", () => {
    const { template } = synth();
    for (const statement of appPolicyStatements(template)) {
      expect(statement.Resource).not.toBe("*");
    }
  });
});

describe("DataStack outputs", () => {
  it("exports the values the app and later phases need", () => {
    const { template } = synth();
    template.hasOutput("TableName", { Value: config.tableName });
    template.hasOutput("BucketName", {});
    template.hasOutput("ImageCdnDomainName", {});
    template.hasOutput("AppUserName", { Value: config.appUserName });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
cd infra
npx vitest run test/data-stack.test.ts
```

Expected: FAIL — cannot find module `../lib/data-stack`.

- [ ] **Step 3: Create the data stack**

Create `infra/lib/data-stack.ts`:

```ts
import * as cdk from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { config } from "./config";

export interface DataStackProps extends cdk.StackProps {
  /** ACM certificate for img.cutecookbook.com, from CertificatesStack. */
  imageCertificate: acm.ICertificate;
}

export class DataStack extends cdk.Stack {
  readonly table: dynamodb.Table;
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly appUser: iam.User;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.table = this.createTable();
    this.bucket = this.createBucket();
    this.distribution = this.createDistribution(props.imageCertificate);
    this.appUser = this.createAppUser();

    new cdk.CfnOutput(this, "TableName", { value: this.table.tableName });
    new cdk.CfnOutput(this, "BucketName", { value: this.bucket.bucketName });
    new cdk.CfnOutput(this, "ImageCdnDomainName", {
      value: this.distribution.distributionDomainName,
      description: "Point the img CNAME at this hostname",
    });
    new cdk.CfnOutput(this, "AppUserName", { value: this.appUser.userName });
  }

  private createTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, "Table", {
      tableName: config.tableName,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: config.gsi1Name,
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    return table;
  }

  private createBucket(): s3.Bucket {
    return new s3.Bucket(this, "ImagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) }],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [...config.corsOrigins],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });
  }

  private createDistribution(certificate: acm.ICertificate): cloudfront.Distribution {
    return new cloudfront.Distribution(this, "ImageCdn", {
      comment: "Cute Cookbook recipe images",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      domainNames: [config.imageDomain],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });
  }

  private createAppUser(): iam.User {
    const user = new iam.User(this, "AppUser", { userName: config.appUserName });

    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "TableItemAccess",
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:TransactWriteItems",
          "dynamodb:ConditionCheckItem",
        ],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      })
    );

    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "ImageObjectAccess",
        actions: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
        resources: [this.bucket.arnForObjects("*")],
      })
    );

    return user;
  }
}
```

- [ ] **Step 4: Wire it into the app**

Replace `infra/bin/app.ts` with:

```ts
import * as cdk from "aws-cdk-lib";
import { CertificatesStack } from "../lib/certificates-stack";
import { config } from "../lib/config";
import { DataStack } from "../lib/data-stack";

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region };

const certificates = new CertificatesStack(app, "CuteCookbookCertificates", { env });

new DataStack(app, "CuteCookbookData", {
  env,
  imageCertificate: certificates.imageCertificate,
});
```

- [ ] **Step 5: Run the data-stack test to verify it passes**

```powershell
npx vitest run test/data-stack.test.ts
```

Expected: PASS, 10 tests. If the `Origins` assertion fails on `S3OriginConfig`, print the synthesized origin with `console.log(JSON.stringify(template.toJSON().Resources, null, 2))` once, align the matcher to the actual OAC shape emitted by your `aws-cdk-lib` version, and remove the log. Do not loosen the `OriginAccessControlId` or `resourceCountIs("AWS::CloudFront::OriginAccessControl", 1)` checks.

- [ ] **Step 6: Full verification**

```powershell
npx vitest run
npm run typecheck
npm run synth
Get-ChildItem cdk.out -Filter "*.template.json" | Select-Object Name
```

Expected: 3 test files / 20 tests pass; typecheck 0; synth 0; both `CuteCookbookCertificates` and `CuteCookbookData` templates present.

- [ ] **Step 7: Commit**

```powershell
cd ..
git add infra/lib/data-stack.ts infra/bin/app.ts infra/test/data-stack.test.ts
git commit -m "feat(infra): data stack with DynamoDB table, private S3 bucket, CloudFront OAC, and least-privilege app user"
```

---

### Task 3: Compute stack — deploy IAM user and gated Lightsail container service

**Files:**
- Create: `infra/lib/compute-stack.ts`
- Modify: `infra/bin/app.ts`
- Test: `infra/test/compute-stack.test.ts`

**Interfaces:**
- Consumes: `CertificatesStack.siteCertificateName: string`; `config`.
- Produces: `ComputeStack` with props `{ siteCertificateName: string; createContainerService: boolean }` and public readonly `deployUser: iam.User`. Output `DeployUserName` always; `ContainerServiceName` only when the service is created. Phase 6 deploys with `-c containerService=true`.

- [ ] **Step 1: Write the failing test**

Create `infra/test/compute-stack.test.ts`:

```ts
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { ComputeStack } from "../lib/compute-stack";
import { config } from "../lib/config";

const env = { account: "123456789012", region: "us-east-1" };

function synth(createContainerService: boolean) {
  const app = new App();
  const stack = new ComputeStack(app, "Compute", {
    env,
    siteCertificateName: config.siteCertificateName,
    createContainerService,
  });
  return { stack, template: Template.fromStack(stack) };
}

type Statement = { Effect: string; Action: string | string[]; Resource: unknown };

describe("ComputeStack deploy user", () => {
  it("creates the deploy user with only the Lightsail actions the pipeline needs", () => {
    const { template } = synth(false);
    template.resourceCountIs("AWS::IAM::User", 1);
    template.hasResourceProperties("AWS::IAM::User", { UserName: config.deployUserName });

    const policies = template.findResources("AWS::IAM::Policy");
    const statements = Object.values(policies).flatMap(
      (p) => (p.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement
    );
    expect(statements).toHaveLength(1);
    expect([...(statements[0].Action as string[])].sort()).toEqual(
      [
        "lightsail:CreateContainerServiceRegistryLogin",
        "lightsail:RegisterContainerImage",
        "lightsail:CreateContainerServiceDeployment",
        "lightsail:GetContainerServices",
        "lightsail:GetContainerServiceDeployments",
        "lightsail:GetContainerImages",
      ].sort()
    );
    // Lightsail does not support resource-level permissions for these actions.
    expect(statements[0].Resource).toBe("*");
  });

  it("always outputs the deploy user name", () => {
    const { template } = synth(false);
    template.hasOutput("DeployUserName", { Value: config.deployUserName });
  });
});

describe("ComputeStack container service gating", () => {
  it("creates no container service by default (Lightsail bills from creation)", () => {
    const { template } = synth(false);
    template.resourceCountIs("AWS::Lightsail::Container", 0);
    expect(template.toJSON().Outputs?.ContainerServiceName).toBeUndefined();
  });

  it("creates the micro/scale-1 service with the site certificate attached when enabled", () => {
    const { template } = synth(true);
    template.resourceCountIs("AWS::Lightsail::Container", 1);
    template.hasResourceProperties("AWS::Lightsail::Container", {
      ServiceName: config.containerServiceName,
      Power: config.containerPower,
      Scale: config.containerScale,
      PublicDomainNames: [
        {
          CertificateName: config.siteCertificateName,
          DomainNames: [config.rootDomain, config.wwwDomain],
        },
      ],
    });
    template.hasOutput("ContainerServiceName", { Value: config.containerServiceName });
  });

  it("never defines a deployment in CloudFormation (deployments come from CI)", () => {
    const { template } = synth(true);
    const containers = template.findResources("AWS::Lightsail::Container");
    const props = Object.values(containers)[0].Properties as Record<string, unknown>;
    expect(props.ContainerServiceDeployment).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
cd infra
npx vitest run test/compute-stack.test.ts
```

Expected: FAIL — cannot find module `../lib/compute-stack`.

- [ ] **Step 3: Create the compute stack**

Create `infra/lib/compute-stack.ts`:

```ts
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lightsail from "aws-cdk-lib/aws-lightsail";
import type { Construct } from "constructs";
import { config } from "./config";

export interface ComputeStackProps extends cdk.StackProps {
  /** Name of the Lightsail certificate from CertificatesStack (must be ISSUED before attaching). */
  siteCertificateName: string;
  /**
   * Lightsail bills a container service from the moment it exists, enabled or not.
   * Keep this false until Phase 6, immediately before the first deployment.
   */
  createContainerService: boolean;
}

export class ComputeStack extends cdk.Stack {
  readonly deployUser: iam.User;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    this.deployUser = this.createDeployUser();
    new cdk.CfnOutput(this, "DeployUserName", { value: this.deployUser.userName });

    if (props.createContainerService) {
      const service = this.createContainerService(props.siteCertificateName);
      new cdk.CfnOutput(this, "ContainerServiceName", { value: service.serviceName });
    }
  }

  private createDeployUser(): iam.User {
    const user = new iam.User(this, "DeployUser", { userName: config.deployUserName });
    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "LightsailContainerDeploy",
        actions: [
          "lightsail:CreateContainerServiceRegistryLogin",
          "lightsail:RegisterContainerImage",
          "lightsail:CreateContainerServiceDeployment",
          "lightsail:GetContainerServices",
          "lightsail:GetContainerServiceDeployments",
          "lightsail:GetContainerImages",
        ],
        // Lightsail does not support resource-level permissions for these actions.
        resources: ["*"],
      })
    );
    return user;
  }

  private createContainerService(siteCertificateName: string): lightsail.CfnContainer {
    return new lightsail.CfnContainer(this, "Service", {
      serviceName: config.containerServiceName,
      power: config.containerPower,
      scale: config.containerScale,
      publicDomainNames: [
        {
          certificateName: siteCertificateName,
          domainNames: [config.rootDomain, config.wwwDomain],
        },
      ],
      // No containerServiceDeployment: CI drives deployments (spec §5).
    });
  }
}
```

- [ ] **Step 4: Wire it into the app with the context flag**

Replace `infra/bin/app.ts` with:

```ts
import * as cdk from "aws-cdk-lib";
import { CertificatesStack } from "../lib/certificates-stack";
import { ComputeStack } from "../lib/compute-stack";
import { config } from "../lib/config";
import { DataStack } from "../lib/data-stack";

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region };

const certificates = new CertificatesStack(app, "CuteCookbookCertificates", { env });

new DataStack(app, "CuteCookbookData", {
  env,
  imageCertificate: certificates.imageCertificate,
});

// Phase 6: `cdk deploy CuteCookbookCompute -c containerService=true`
const createContainerService = app.node.tryGetContext("containerService") === "true";

new ComputeStack(app, "CuteCookbookCompute", {
  env,
  siteCertificateName: certificates.siteCertificateName,
  createContainerService,
});
```

- [ ] **Step 5: Run the compute test to verify it passes**

```powershell
npx vitest run test/compute-stack.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Verify both synth modes**

```powershell
npx vitest run
npm run typecheck
npm run synth
Select-String -Path cdk.out/CuteCookbookCompute.template.json -Pattern "AWS::Lightsail::Container" -Quiet
npx cdk synth --quiet -c containerService=true
Select-String -Path cdk.out/CuteCookbookCompute.template.json -Pattern "AWS::Lightsail::Container" -Quiet
```

Expected: 4 files / 25 tests pass; typecheck 0; first `Select-String` prints `False` (no container by default), second prints `True`.

- [ ] **Step 7: Commit**

```powershell
cd ..
git add infra/lib/compute-stack.ts infra/bin/app.ts infra/test/compute-stack.test.ts
git commit -m "feat(infra): compute stack with deploy user and context-gated Lightsail container service"
```

---

### Task 4: CI job for infra

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: a second job `infra` in the `CI` workflow running typecheck, tests, and a credential-free synth on every PR and push. The existing `quality` job is unchanged.

- [ ] **Step 1: Add the job**

Append to `.github/workflows/ci.yml` (after the `quality` job, same indentation level under `jobs:`):

```yaml
  infra:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: infra/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Synth (no credentials)
        run: npm run synth
```

- [ ] **Step 2: Validate locally the same way CI will**

```powershell
cd infra
npm ci
npm run typecheck
npm test
npm run synth
cd ..
```

Expected: all exit 0. (`npm ci` here just reinstalls from the lockfile.)

- [ ] **Step 3: Commit, push, open PR, watch**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: typecheck, test, and synth the CDK infra package"
git push -u origin feat/aws-migration-phase-1
Set-Content -Path $env:TEMP\pr-body.md -Value @"
## Phase 1: Infrastructure (CDK)

- ``infra/`` standalone CDK package (TypeScript, Vitest).
- ``CuteCookbookCertificates``: ACM cert for ``img.cutecookbook.com`` + Lightsail cert for apex/www.
- ``CuteCookbookData``: DynamoDB single table (PK/SK + GSI1, on-demand, PITR, RETAIN), private S3 bucket (Block Public Access, SSL-only, upload CORS, multipart cleanup, RETAIN), CloudFront with Origin Access Control, least-privilege ``cute-cookbook-app`` IAM user.
- ``CuteCookbookCompute``: ``cute-cookbook-deploy`` IAM user; Lightsail container service gated behind ``-c containerService=true`` (not created until Phase 6 — Lightsail bills from creation).
- 25 CDK assertion tests; CI ``infra`` job runs typecheck, tests, and a credential-free synth.
- Root tsconfig/eslint exclude ``infra/``.

## Test plan
- ``cd infra; npm test`` → 4 files / 25 tests
- ``npm run typecheck``, ``npm run synth``, ``npx cdk synth -c containerService=true``
- Root ``npm run lint``, ``npm run build`` unaffected
- CI: ``quality`` and ``infra`` jobs green

Deployment to the AWS account happens after merge per the Phase 1 plan's Task 5 runbook.
"@
gh pr create --base master --title "Phase 1: CDK infrastructure (certificates, data, compute)" --body-file $env:TEMP\pr-body.md
gh pr checks --watch
```

Expected: `CI / quality` and `CI / infra` both pass. (`Vercel Deploy / deploy-preview` also runs; it is unaffected by `infra/` and should pass.)

---

### Task 5: Deploy to AWS and record outputs (human, guided)

This task changes real AWS state and needs console and DNS access. Do it yourself with the assistant walking alongside; do not delegate it to an implementer subagent. Every command assumes `$env:AWS_PROFILE = "cute-cookbook"` is set and you are in `infra/`.

**Files:**
- Modify: `.env.local` (root, git-ignored) — new AWS variables
- Modify: `docs/resume-highlights.md` — flip bullets to `done`

- [ ] **Step 1: Bootstrap CDK in the account/region (one time)**

```powershell
cd infra
$account = (aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap "aws://$account/us-east-1"
```

Expected: ends with `✅  Environment aws://<account>/us-east-1 bootstrapped.` This creates the `CDKToolkit` stack (an S3 bucket, an ECR repo, and IAM roles); cost is cents.

- [ ] **Step 2: Deploy the certificates stack and add the validation CNAMEs**

```powershell
npx cdk deploy CuteCookbookCertificates
```

The deploy will create the Lightsail certificate quickly and then sit at `CuteCookbookCertificates | CREATE_IN_PROGRESS | AWS::CertificateManager::Certificate | ImageCertificate` — this is expected. In a **second terminal** (same profile):

```powershell
# ACM validation record for img.cutecookbook.com
aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='img.cutecookbook.com'].CertificateArn" --output text
aws acm describe-certificate --region us-east-1 --certificate-arn <ARN-from-above> --query "Certificate.DomainValidationOptions[0].ResourceRecord"

# Lightsail validation records for cutecookbook.com and www
aws lightsail get-certificates --region us-east-1 --certificate-name cute-cookbook-site --include-certificate-details --query "certificates[0].certificateDetail.domainValidationRecords"
```

Add the three CNAMEs at your DNS provider exactly as printed (`Name` → `Value`). Some providers want the record name without the trailing `.cutecookbook.com.`; enter only the leading `_xxxx` label if so. Leave the first terminal running; within ~5–30 minutes of the ACM record propagating it prints `✅  CuteCookbookCertificates` with the two outputs. If it has not completed after 45 minutes, check `aws acm describe-certificate ... --query "Certificate.Status"` — `PENDING_VALIDATION` with a correct record just needs more time; `FAILED` or a wrong record means fix the CNAME (the stack waits up to 72 h).

Confirm the Lightsail certificate too (it does not block the stack):

```powershell
aws lightsail get-certificates --region us-east-1 --certificate-name cute-cookbook-site --query "certificates[0].certificateDetail.status" --output text
```

Expected eventually: `ISSUED`. It only needs to be issued before Phase 6.

- [ ] **Step 3: Deploy the data stack**

```powershell
npx cdk diff CuteCookbookData
npx cdk deploy CuteCookbookData
```

Review the diff (1 table, 1 bucket + policy, 1 OAC, 1 distribution, 1 user + 1 policy, outputs), answer `y` to the IAM prompt. CloudFront takes 3–8 minutes. Expected end: `✅  CuteCookbookData` with outputs `TableName`, `BucketName`, `ImageCdnDomainName` (a `*.cloudfront.net` hostname), `AppUserName`.

Add the fourth DNS record: `img` **CNAME** → the `ImageCdnDomainName` value.

- [ ] **Step 4: Deploy the compute stack (deploy user only)**

```powershell
npx cdk deploy CuteCookbookCompute
```

Expected: `✅  CuteCookbookCompute` with output `DeployUserName`. Confirm nothing billable was created:

```powershell
aws lightsail get-container-services --region us-east-1 --query "containerServices[].containerServiceName"
```

Expected: `[]`.

- [ ] **Step 5: Create the app user's access key and record local env**

```powershell
aws iam create-access-key --user-name cute-cookbook-app --query "AccessKey.[AccessKeyId,SecretAccessKey]" --output text
```

Copy the two values immediately (the secret is shown once). Append to the repo-root `.env.local` (it is git-ignored — verify with `git check-ignore .env.local`, which should print the path):

```
# AWS (Phase 1) — app runtime credentials, least-privilege user
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<AccessKeyId>
AWS_SECRET_ACCESS_KEY=<SecretAccessKey>
TABLE_NAME=cute-cookbook
BUCKET_NAME=<BucketName output>
IMAGE_CDN_HOST=img.cutecookbook.com
```

Do **not** create the deploy user's key yet; Phase 6 creates it when it goes into GitHub Secrets.

- [ ] **Step 6: Round-trip the real resources as the app user**

Run these with the *app* credentials to prove the least-privilege policy is sufficient (and nothing more):

```powershell
$env:AWS_ACCESS_KEY_ID = "<AccessKeyId>"; $env:AWS_SECRET_ACCESS_KEY = "<SecretAccessKey>"; Remove-Item Env:AWS_PROFILE
$bucket = "<BucketName output>"

# DynamoDB write + read + delete
aws dynamodb put-item --region us-east-1 --table-name cute-cookbook --item '{\"PK\":{\"S\":\"SMOKE#1\"},\"SK\":{\"S\":\"SMOKE\"},\"GSI1PK\":{\"S\":\"SMOKE\"},\"GSI1SK\":{\"S\":\"1\"}}'
aws dynamodb query --region us-east-1 --table-name cute-cookbook --index-name GSI1 --key-condition-expression "GSI1PK = :p" --expression-attribute-values '{\":p\":{\"S\":\"SMOKE\"}}' --query "Count"
aws dynamodb delete-item --region us-east-1 --table-name cute-cookbook --key '{\"PK\":{\"S\":\"SMOKE#1\"},\"SK\":{\"S\":\"SMOKE\"}}'

# Least privilege: a Scan must be denied
aws dynamodb scan --region us-east-1 --table-name cute-cookbook --select COUNT

# S3 upload, CDN fetch, delete
Set-Content -Path $env:TEMP\smoke.txt -Value "hello"
aws s3 cp $env:TEMP\smoke.txt "s3://$bucket/covers/smoke.txt" --content-type text/plain
curl.exe -i "https://img.cutecookbook.com/covers/smoke.txt"
aws s3 rm "s3://$bucket/covers/smoke.txt"

# Least privilege: listing the bucket must be denied
aws s3 ls "s3://$bucket/"
```

Expected: put/query (`1`)/delete succeed; `scan` fails with `AccessDeniedException`; `s3 cp` succeeds; `curl.exe` returns `HTTP/2 200` with body `hello` (if the `img` CNAME was added minutes ago and you get a resolution error, wait and retry; if you get `403` from CloudFront, the OAC bucket policy has not propagated yet — retry in a minute); `s3 rm` succeeds; `s3 ls` fails with `AccessDenied`.

Restore your admin profile afterward: `Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY; $env:AWS_PROFILE = "cute-cookbook"`.

- [ ] **Step 7: Check the bill**

Console → Billing → *Bills* (or `aws ce get-cost-and-usage` if you prefer). Expected: today's charges are effectively $0 (CDK bootstrap S3 and CloudFront/DynamoDB free-tier usage). If anything shows a Lightsail compute line, a container service exists and must be deleted.

- [ ] **Step 8: Update the resume log and commit**

In `docs/resume-highlights.md`, change the first bullet's tag from `planned` to `done` and reword it to reflect what is actually live:

```markdown
- `done` Defined all AWS infrastructure for a Next.js 16 app in AWS CDK (TypeScript): DynamoDB single table, private S3 behind CloudFront with Origin Access Control, ACM and Lightsail certificates, and least-privilege IAM users — with 25 CDK assertion tests enforcing retention policies, public-access blocking, and exact IAM action/resource scoping in CI.
```

Change the "Applied least-privilege IAM" bullet to `done`. Add to *Talking points*:

```markdown
- Caught a billing trap in design review: Lightsail bills a container service from creation even when disabled or empty, so the service is gated behind a CDK context flag and created only immediately before the first deployment, saving ~$10/mo for every month of build time.
- Isolated manually-validated certificates in their own CDK stack because ACM DNS validation without Route 53 blocks a CloudFormation stack in CREATE_IN_PROGRESS until the CNAME exists.
```

```powershell
cd ..
git add docs/resume-highlights.md
git commit -m "docs: mark CDK infrastructure and least-privilege IAM as done in resume highlights"
git push
```

---

## Phase 1 exit checklist

- [ ] `cd infra; npm test` → 4 files / 25 tests pass locally; `CI / infra` green on the PR.
- [ ] Root `npm run lint` and `npm run build` still pass (infra excluded from the Next toolchain).
- [ ] Stacks `CuteCookbookCertificates`, `CuteCookbookData`, `CuteCookbookCompute` are `CREATE_COMPLETE` in us-east-1.
- [ ] ACM certificate for `img.cutecookbook.com` is `ISSUED`; Lightsail certificate `cute-cookbook-site` is `ISSUED` (or at least `PENDING_VALIDATION` with records in place).
- [ ] `https://img.cutecookbook.com/<key>` serves an object uploaded by the app user; Scan and ListBucket are denied for that user.
- [ ] `aws lightsail get-container-services` returns `[]` — nothing billable exists.
- [ ] `.env.local` holds `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `TABLE_NAME`, `BUCKET_NAME`, `IMAGE_CDN_HOST`; `git status` shows it untracked/ignored.
- [ ] `docs/resume-highlights.md` updated.
- [ ] Production on Vercel is unchanged (the four new DNS records are all CNAMEs on names the live site does not use).

Next: Phase 2 plan (`src/lib/db` repositories, `src/lib/storage/s3.ts`, config).


