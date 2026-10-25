import * as cdk from "aws-cdk-lib";
import * as lightsail from "aws-cdk-lib/aws-lightsail";
import type { Construct } from "constructs";
import { config } from "./config";

/**
 * The Lightsail certificate is isolated because it must be ISSUED before a container
 * service can attach it, and DNS validation holds the stack until the CNAME is added.
 * The CloudFront certificate lives in ImageCertificateStack (us-east-1).
 */
export class CertificatesStack extends cdk.Stack {
  readonly siteCertificateName: string;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const siteCertificate = new lightsail.CfnCertificate(this, "SiteCertificate", {
      certificateName: config.siteCertificateName,
      domainName: config.rootDomain,
      subjectAlternativeNames: [config.wwwDomain],
    });
    this.siteCertificateName = siteCertificate.certificateName;

    new cdk.CfnOutput(this, "SiteCertificateName", {
      value: siteCertificate.certificateName,
      description: "Lightsail certificate to attach to the container service in Phase 6",
    });
  }
}
