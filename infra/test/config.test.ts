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
  it("targets the project Region", () => {
    expect(config.region).toBe("us-east-2");
  });

  it("keeps the CloudFront certificate in us-east-1", () => {
    expect(config.cloudFrontCertificateRegion).toBe("us-east-1");
    expect(config.accountId).toMatch(/^\d{12}$/);
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
