import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import type { Construct } from "constructs";
import { config } from "./config";

/**
 * CloudFront only accepts an ACM certificate from us-east-1.
 * DNS validation without Route 53 holds this stack in CREATE_IN_PROGRESS until the CNAME is added.
 * The app does not instantiate this stack: CloudFormation is denied in us-east-1 on this project.
 */
export class ImageCertificateStack extends cdk.Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.certificate = new acm.Certificate(this, "ImageCertificate", {
      domainName: config.imageDomain,
      validation: acm.CertificateValidation.fromDns(),
    });

    new cdk.CfnOutput(this, "ImageCertificateArn", {
      value: this.certificate.certificateArn,
      description: "ACM certificate for img.cutecookbook.com (used by CloudFront)",
    });
  }
}
