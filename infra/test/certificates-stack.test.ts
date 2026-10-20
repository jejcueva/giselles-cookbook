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
