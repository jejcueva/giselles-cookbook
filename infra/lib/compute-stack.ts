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
    new cdk.CfnOutput(this, "DeployUserName", { value: config.deployUserName });

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
