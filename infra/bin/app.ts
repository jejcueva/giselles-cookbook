import * as cdk from "aws-cdk-lib";
import { CertificatesStack } from "../lib/certificates-stack";
import { config } from "../lib/config";

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region };

new CertificatesStack(app, "CuteCookbookCertificates", { env });
