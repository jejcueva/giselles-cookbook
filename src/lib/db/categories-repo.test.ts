import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { categoriesRepo } from "@/lib/db/categories-repo";
import { ConflictError, NotFoundError } from "@/lib/db/errors";

vi.mock("@/lib/config", () => ({ config: {
  region: "us-east-2", tableName: "test-table", bucketName: "test-images",
  imageCdnHost: "d2gmo95al03pdi.cloudfront.net",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
} }));
const ddb = mockClient(DynamoDBDocumentClient);
const category = {
  PK: "CATEGORY#c1", SK: "CATEGORY", GSI1PK: "CATEGORY", GSI1SK: "dinner",
  id: "c1", name: "Dinner", emoji: null, createdAt: "2026-10-19T00:00:00.000Z",
};
const recipe = {
  PK: "RECIPE#r1", SK: "RECIPE", GSI1PK: "RECIPE", GSI1SK: "2026-10-19T00:00:00.000Z#r1",
  id: "r1", title: "Soup", ingredients: [], instructions: [], notes: null, sourceUrl: null,
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: true, categoryIds: ["c1", "c2"], tags: [], photos: [], coverImage: "covers/keep.png",
  createdAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-19T00:00:00.000Z",
};
function canceled(codes: string[]) {
  return Object.assign(new Error("Transaction canceled"), {
    name: "TransactionCanceledException", CancellationReasons: codes.map((Code) => ({ Code })),
  });
}
function tx() { return ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!; }
beforeEach(() => {
  ddb.reset();
  ddb.on(GetCommand).resolves({ Item: category });
  ddb.on(TransactWriteCommand).resolves({});
  ddb.on(QueryCommand).resolves({ Items: [] });
});

describe("categoriesRepo", () => {
  it("queries categories alphabetically through every page and strips table keys", async () => {
    const cursor = { PK: "CATEGORY#c1", SK: "CATEGORY" };
    ddb.on(QueryCommand).resolvesOnce({ LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [category], LastEvaluatedKey: {} });
    expect(await categoriesRepo.list()).toEqual([{
      id: "c1", name: "Dinner", emoji: null, createdAt: category.createdAt,
    }]);
    const queries = ddb.commandCalls(QueryCommand).map((call) => call.args[0].input);
    expect(queries[0]).toEqual({ TableName: "test-table", IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :kind", ExpressionAttributeValues: { ":kind": "CATEGORY" },
      ScanIndexForward: true, ExclusiveStartKey: undefined });
    expect(queries[1].ExclusiveStartKey).toEqual(cursor);
  });

  it("reads a category consistently", async () => {
    expect(await categoriesRepo.getById("c1")).toMatchObject({ name: "Dinner", emoji: null });
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: "test-table", Key: { PK: "CATEGORY#c1", SK: "CATEGORY" }, ConsistentRead: true,
    });
  });

  it("throws for a missing category", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(categoriesRepo.getById("missing")).rejects.toBeInstanceOf(NotFoundError);
    await expect(categoriesRepo.rename("missing", "Lunch")).rejects.toBeInstanceOf(NotFoundError);
    await expect(categoriesRepo.delete("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates the uniqueness item and category in one transaction", async () => {
    const result = await categoriesRepo.create({ name: " Dinner ", emoji: null }, { id: "c1" });
    expect(result).toMatchObject({ id: "c1", name: "Dinner", emoji: null });
    expect(tx()).toEqual([
      { Put: { TableName: "test-table", Item: { PK: "CATEGORYNAME#dinner", SK: "CATEGORYNAME" }, ConditionExpression: "attribute_not_exists(PK)" } },
      { Put: { TableName: "test-table", Item: { ...category, createdAt: result.createdAt }, ConditionExpression: "attribute_not_exists(PK)" } },
    ]);
  });

  it("generates a category id when no override is supplied", async () => {
    expect((await categoriesRepo.create({ name: "Lunch", emoji: "L" })).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects blank names before writing", async () => {
    await expect(categoriesRepo.create({ name: " ", emoji: null })).rejects.toThrow("name");
    await expect(categoriesRepo.rename("c1", " ")).rejects.toThrow("name");
    expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it.each([0, 1])("maps create conditional failure at action %s to ConflictError", async (index) => {
    ddb.on(TransactWriteCommand).rejects(canceled(index === 0 ? ["ConditionalCheckFailed", "None"] : ["None", "ConditionalCheckFailed"]));
    await expect(categoriesRepo.create({ name: "DINNER", emoji: null })).rejects.toBeInstanceOf(ConflictError);
  });

  it("propagates transaction failures with no conditional reason", async () => {
    const error = canceled(["ProvisionedThroughputExceeded", "None"]);
    ddb.on(TransactWriteCommand).rejects(error);
    await expect(categoriesRepo.create({ name: "Dinner", emoji: null })).rejects.toBe(error);
  });

  it("propagates cancellations without reasons and other AWS errors", async () => {
    const noReasons = Object.assign(new Error("Canceled"), { name: "TransactionCanceledException" });
    const denied = new Error("Access denied");
    ddb.on(TransactWriteCommand).rejectsOnce(noReasons).rejectsOnce(denied);
    await expect(categoriesRepo.create({ name: "Dinner", emoji: null })).rejects.toBe(noReasons);
    await expect(categoriesRepo.create({ name: "Dinner", emoji: null })).rejects.toBe(denied);
  });

  it("renames with a guarded category update and atomic uniqueness swap", async () => {
    expect(await categoriesRepo.rename("c1", " Lunch ")).toMatchObject({ name: "Lunch", createdAt: category.createdAt });
    expect(tx()).toHaveLength(3);
    expect(tx()[0].Update).toMatchObject({ Key: { PK: "CATEGORY#c1", SK: "CATEGORY" },
      ConditionExpression: "attribute_exists(PK) AND #name = :old",
      ExpressionAttributeValues: { ":name": "Lunch", ":sort": "lunch", ":old": "Dinner" } });
    expect(tx()[1].Delete).toEqual({ TableName: "test-table", Key: { PK: "CATEGORYNAME#dinner", SK: "CATEGORYNAME" } });
    expect(tx()[2].Put).toEqual({ TableName: "test-table", Item: { PK: "CATEGORYNAME#lunch", SK: "CATEGORYNAME" },
      ConditionExpression: "attribute_not_exists(PK)" });
  });

  it("handles a case-only rename without targeting the uniqueness item twice", async () => {
    expect((await categoriesRepo.rename("c1", "DINNER")).name).toBe("DINNER");
    expect(tx()).toHaveLength(1);
    expect(tx()[0].Update?.ExpressionAttributeValues).toMatchObject({ ":sort": "dinner" });
  });

  it("rejects a duplicate rename", async () => {
    ddb.on(TransactWriteCommand).rejects(canceled(["None", "None", "ConditionalCheckFailed"]));
    await expect(categoriesRepo.rename("c1", "Lunch")).rejects.toBeInstanceOf(ConflictError);
  });

  it("reports a concurrent rename as a conflict without deleting a newer lock", async () => {
    ddb.on(GetCommand).resolvesOnce({ Item: category }).resolvesOnce({ Item: { ...category, name: "Brunch" } });
    ddb.on(TransactWriteCommand).rejects(canceled(["ConditionalCheckFailed", "None", "None"]));
    await expect(categoriesRepo.rename("c1", "Lunch")).rejects.toBeInstanceOf(ConflictError);
    expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(1);
  });

  it("reports a category removed during a transaction as missing", async () => {
    ddb.on(GetCommand).resolvesOnce({ Item: category }).resolvesOnce({});
    ddb.on(TransactWriteCommand).rejects(canceled(["ConditionalCheckFailed", "None"]));
    await expect(categoriesRepo.delete("c1")).rejects.toBeInstanceOf(NotFoundError);
    expect(ddb.commandCalls(QueryCommand)).toHaveLength(0);
  });

  it("sets and clears emoji with a conditional update", async () => {
    ddb.on(UpdateCommand).resolvesOnce({ Attributes: { ...category, emoji: "L" } })
      .resolvesOnce({ Attributes: category });
    expect((await categoriesRepo.setEmoji("c1", "L")).emoji).toBe("L");
    expect((await categoriesRepo.setEmoji("c1", null)).emoji).toBeNull();
    expect(ddb.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      ConditionExpression: "attribute_exists(PK)", UpdateExpression: "SET emoji = :emoji", ReturnValues: "ALL_NEW",
    });
  });

  it("maps only missing emoji updates to NotFoundError", async () => {
    const missing = Object.assign(new Error("Missing"), { name: "ConditionalCheckFailedException" });
    const error = new Error("DynamoDB down");
    ddb.on(UpdateCommand).rejectsOnce(missing).rejectsOnce(error);
    await expect(categoriesRepo.setEmoji("missing", null)).rejects.toBeInstanceOf(NotFoundError);
    await expect(categoriesRepo.setEmoji("c1", null)).rejects.toBe(error);
  });

  it("deletes both category items, then removes only its id from matching recipes", async () => {
    const cursor = { PK: "RECIPE#r1", SK: "RECIPE" };
    ddb.on(QueryCommand).resolvesOnce({ Items: [{ ...recipe, id: "other", categoryIds: ["c2"] }], LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [recipe] });
    ddb.on(UpdateCommand).resolves({ Attributes: recipe });
    await categoriesRepo.delete("c1");
    expect(tx()).toEqual([
      { Delete: { TableName: "test-table", Key: { PK: "CATEGORY#c1", SK: "CATEGORY" },
        ConditionExpression: "attribute_exists(PK) AND #name = :old",
        ExpressionAttributeNames: { "#name": "name" }, ExpressionAttributeValues: { ":old": "Dinner" } } },
      { Delete: { TableName: "test-table", Key: { PK: "CATEGORYNAME#dinner", SK: "CATEGORYNAME" } } },
    ]);
    const update = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(1);
    expect(Object.values(update.ExpressionAttributeNames!)).toEqual(["categoryIds", "updatedAt"]);
    expect(update.ExpressionAttributeValues![":v0"]).toEqual(["c2"]);
    expect(recipe.categoryIds).toEqual(["c1", "c2"]);
    expect(ddb.calls()[1].args[0]).toBeInstanceOf(TransactWriteCommand);
    expect(ddb.calls()[2].args[0]).toBeInstanceOf(QueryCommand);
  });

  it("tolerates a recipe concurrently deleted during cleanup", async () => {
    ddb.on(QueryCommand).resolves({ Items: [recipe] });
    ddb.on(UpdateCommand).rejects(Object.assign(new Error("Missing"), { name: "ConditionalCheckFailedException" }));
    await expect(categoriesRepo.delete("c1")).resolves.toBeUndefined();
  });

  it("fails loudly if recipe cleanup cannot finish", async () => {
    const error = new Error("DynamoDB unavailable");
    ddb.on(QueryCommand).resolves({ Items: [recipe] });
    ddb.on(UpdateCommand).rejects(error);
    await expect(categoriesRepo.delete("c1")).rejects.toBe(error);
  });

  it("propagates read errors without starting category writes", async () => {
    const error = new Error("DynamoDB unavailable");
    ddb.on(GetCommand).rejects(error); ddb.on(QueryCommand).rejects(error);
    await expect(categoriesRepo.getById("c1")).rejects.toBe(error);
    await expect(categoriesRepo.list()).rejects.toBe(error);
    expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });
});
