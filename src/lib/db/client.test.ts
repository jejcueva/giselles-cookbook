import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({ config: {
  region: "us-east-2", tableName: "test-table",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
} }));

it("creates one document client with undefined omission and explicit config", async () => {
  const spy = vi.spyOn(DynamoDBDocumentClient, "from");
  const { db, tableName } = await import("@/lib/db/client");
  expect(tableName).toBe("test-table");
  expect(db).toBeInstanceOf(DynamoDBDocumentClient);
  expect(spy).toHaveBeenCalledWith(expect.any(DynamoDBClient), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const base = spy.mock.calls[0][0];
  expect(await base.config.region()).toBe("us-east-2");
  expect(await base.config.credentials()).toMatchObject({ accessKeyId: "test" });
  spy.mockRestore();
});
