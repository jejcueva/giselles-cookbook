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
