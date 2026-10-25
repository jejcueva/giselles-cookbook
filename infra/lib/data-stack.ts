import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { config } from "./config";

export interface DataStackProps extends cdk.StackProps {
  /**
   * ACM certificate for img.cutecookbook.com. Must be in us-east-1.
   * Omit it to serve the CDN on the default cloudfront.net hostname.
   */
  imageCertificate?: acm.ICertificate;
  /** us-east-1 ACM certificate ARN. Used when `imageCertificate` is omitted. */
  imageCertificateArn?: string;
}

export class DataStack extends cdk.Stack {
  readonly table: dynamodb.Table;
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly appUser: iam.User;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const imageCertificate =
      props.imageCertificate ??
      (props.imageCertificateArn
        ? acm.Certificate.fromCertificateArn(this, "ImageCertificate", props.imageCertificateArn)
        : undefined);

    this.table = this.createTable();
    this.bucket = this.createBucket();
    this.distribution = this.createDistribution(imageCertificate);
    this.appUser = this.createAppUser();

    // table.tableName and user.userName synthesize as CloudFormation Refs.
    // These outputs use the configured literals so the template exports the names directly.
    new cdk.CfnOutput(this, "TableName", { value: config.tableName });
    new cdk.CfnOutput(this, "BucketName", { value: this.bucket.bucketName });
    new cdk.CfnOutput(this, "ImageCdnDomainName", {
      value: this.distribution.distributionDomainName,
      description: "Point the img CNAME at this hostname",
    });
    new cdk.CfnOutput(this, "AppUserName", { value: config.appUserName });
  }

  private createTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, "Table", {
      tableName: config.tableName,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: config.gsi1Name,
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    return table;
  }

  private createBucket(): s3.Bucket {
    return new s3.Bucket(this, "ImagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) }],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [...config.corsOrigins],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });
  }

  private createDistribution(certificate?: acm.ICertificate): cloudfront.Distribution {
    return new cloudfront.Distribution(this, "ImageCdn", {
      comment: "Cute Cookbook recipe images",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      ...(certificate ? { domainNames: [config.imageDomain], certificate } : {}),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });
  }

  private createAppUser(): iam.User {
    const user = new iam.User(this, "AppUser", { userName: config.appUserName });

    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "TableItemAccess",
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:TransactWriteItems",
          "dynamodb:ConditionCheckItem",
        ],
        resources: [this.table.tableArn, `${this.table.tableArn}/index/*`],
      })
    );

    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "ImageObjectAccess",
        actions: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
        resources: [this.bucket.arnForObjects("*")],
      })
    );

    return user;
  }
}
