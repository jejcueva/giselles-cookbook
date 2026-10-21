import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "@/lib/config";

const client = new DynamoDBClient({ region: config.region, credentials: config.credentials });
export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
export const tableName = config.tableName;
