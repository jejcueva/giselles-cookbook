import * as cdk from "aws-cdk-lib";
import { CertificatesStack } from "../lib/certificates-stack";
import { ComputeStack } from "../lib/compute-stack";
import { config } from "../lib/config";
import { DataStack } from "../lib/data-stack";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT ?? config.accountId;
const projectEnv = { account, region: config.region };

const certificates = new CertificatesStack(app, "CuteCookbookCertificates", { env: projectEnv });

// CloudFormation is denied in us-east-1 on this project, so CuteCookbookImageCertificate
// is not created here. After that certificate is issued, redeploy with
// `-c imageCertificateArn=<arn>` to attach img.cutecookbook.com.
const imageCertificateArn = app.node.tryGetContext("imageCertificateArn") as string | undefined;

new DataStack(app, "CuteCookbookData", {
  env: projectEnv,
  imageCertificateArn,
});

// Phase 6: `cdk deploy CuteCookbookCompute -c containerService=true`
const createContainerService = app.node.tryGetContext("containerService") === "true";

new ComputeStack(app, "CuteCookbookCompute", {
  env: projectEnv,
  siteCertificateName: certificates.siteCertificateName,
  createContainerService,
});
