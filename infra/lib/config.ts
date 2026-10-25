/** Single source of truth for names, domains, and sizes used across all stacks. */
export const config = {
  /** This project's assigned Region. DynamoDB, S3, Lightsail, and those stacks deploy here. */
  region: "us-east-2",
  /**
   * CloudFront accepts ACM certificates only from us-east-1.
   * This project denies CloudFormation there, so that certificate is not part of
   * the default deploy. Pass `-c imageCertificateArn=...` after the certificate is issued.
   */
  cloudFrontCertificateRegion: "us-east-1",
  /** Member project. CI synth has no credentials, so this is the fallback account. */
  accountId: "592685885054",

  rootDomain: "cutecookbook.com",
  wwwDomain: "www.cutecookbook.com",
  imageDomain: "img.cutecookbook.com",

  tableName: "cute-cookbook",
  gsi1Name: "GSI1",

  appUserName: "cute-cookbook-app",
  deployUserName: "cute-cookbook-deploy",

  siteCertificateName: "cute-cookbook-site",
  containerServiceName: "cute-cookbook",
  containerPower: "micro",
  containerScale: 1,

  corsOrigins: ["https://cutecookbook.com", "https://www.cutecookbook.com", "http://localhost:3000"],
} as const;
