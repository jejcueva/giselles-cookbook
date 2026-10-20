/** Single source of truth for names, domains, and sizes used across all stacks. */
export const config = {
  region: "us-east-1",

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
