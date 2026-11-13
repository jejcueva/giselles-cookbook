import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { config } from "../lib/config";
import { DataStack } from "../lib/data-stack";
import { ImageCertificateStack } from "../lib/image-certificate-stack";

const account = "123456789012";
const env = { account, region: config.region };

function synth() {
  const app = new App();
  const imageCertificate = new ImageCertificateStack(app, "ImageCert", {
    env: { account, region: config.cloudFrontCertificateRegion },
    crossRegionReferences: true,
  });
  const stack = new DataStack(app, "Data", {
    env,
    crossRegionReferences: true,
    imageCertificate: imageCertificate.certificate,
  });
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
  it("uses the default hostname until an us-east-1 certificate ARN is supplied", () => {
    const app = new App();
    const stack = new DataStack(app, "Data", { env });
    const template = Template.fromStack(stack);
    const distributions = template.findResources("AWS::CloudFront::Distribution");
    const distributionConfig = (
      Object.values(distributions)[0].Properties as {
        DistributionConfig: { Aliases?: string[]; ViewerCertificate?: unknown };
      }
    ).DistributionConfig;
    expect(distributionConfig.Aliases).toBeUndefined();
    expect(distributionConfig.ViewerCertificate).toBeUndefined();
  });

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
