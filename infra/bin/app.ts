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
