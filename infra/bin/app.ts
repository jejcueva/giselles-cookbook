import * as cdk from "aws-cdk-lib";
import { CertificatesStack } from "../lib/certificates-stack";
import { ComputeStack } from "../lib/compute-stack";
import { config } from "../lib/config";
import { DataStack } from "../lib/data-stack";

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region };

const certificates = new CertificatesStack(app, "CuteCookbookCertificates", { env });

new DataStack(app, "CuteCookbookData", {
  env,
  imageCertificate: certificates.imageCertificate,
});

// Phase 6: `cdk deploy CuteCookbookCompute -c containerService=true`
const createContainerService = app.node.tryGetContext("containerService") === "true";

new ComputeStack(app, "CuteCookbookCompute", {
  env,
  siteCertificateName: certificates.siteCertificateName,
  createContainerService,
});
