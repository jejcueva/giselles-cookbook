import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { config } from "../lib/config";
import { ImageCertificateStack } from "../lib/image-certificate-stack";

const env = { account: "123456789012", region: config.cloudFrontCertificateRegion };

function synth() {
  const app = new App();
  const stack = new ImageCertificateStack(app, "ImageCert", { env });
  return { stack, template: Template.fromStack(stack) };
}

describe("ImageCertificateStack", () => {
  it("deploys in us-east-1, the only Region CloudFront accepts", () => {
    const { stack } = synth();
    expect(stack.region).toBe("us-east-1");
  });

  it("requests a DNS-validated ACM certificate for the image CDN domain", () => {
    const { template } = synth();
    template.resourceCountIs("AWS::CertificateManager::Certificate", 1);
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: config.imageDomain,
      ValidationMethod: "DNS",
    });
    template.hasOutput("ImageCertificateArn", {});
  });

  it("creates nothing that costs money", () => {
    const { template } = synth();
    const resources = template.toJSON().Resources as Record<string, { Type: string }>;
    const types = new Set(Object.values(resources).map((r) => r.Type));
    expect([...types].sort()).toEqual(["AWS::CertificateManager::Certificate"]);
  });
});
