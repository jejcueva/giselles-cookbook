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
