import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateRecipeInput, Recipe } from "@/lib/types";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { recipesRepo } from "@/lib/db/recipes-repo";

vi.mock("@/lib/config", () => ({ config: {
  region: "us-east-2", tableName: "test-table", bucketName: "test-images",
  imageCdnHost: "d2gmo95al03pdi.cloudfront.net",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
} }));
const ddb = mockClient(DynamoDBDocumentClient);
const s3 = mockClient(S3Client);
const input: CreateRecipeInput = {
  title: "Soup", ingredients: [{ name: "water", amount: "1", unit: "cup" }],
  instructions: [{ stepNumber: 1, text: "Boil" }], notes: null, sourceUrl: null,
  cookTime: null, prepTime: null, servings: null, calories: null, protein: null, carbs: null, fat: null,
  isFavorite: false, categoryIds: ["c1"], tags: ["easy"], photos: [{ key: "photos/r1/a.png", sortOrder: 0 }],
  coverImage: "covers/old.png",
};
function item(patch: Partial<Recipe> = {}) {
  const recipe = { ...input, id: "r1", createdAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-19T00:00:00.000Z", ...patch };
  return { ...recipe, PK: `RECIPE#${recipe.id}`, SK: "RECIPE", GSI1PK: "RECIPE", GSI1SK: `${recipe.createdAt}#${recipe.id}` };
}
const conditional = Object.assign(new Error("condition failed"), { name: "ConditionalCheckFailedException" });
beforeEach(() => { ddb.reset(); s3.reset(); s3.on(DeleteObjectCommand).resolves({}); });
afterEach(() => vi.restoreAllMocks());

describe("recipesRepo", () => {
  it("queries newest first through empty pages and filters favorites and categories", async () => {
    const cursor = { PK: "RECIPE#cursor", SK: "RECIPE" };
    ddb.on(QueryCommand)
      .resolvesOnce({ LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [item({ id: "new", isFavorite: true }), item({ id: "other", isFavorite: true, categoryIds: ["c2"] })], LastEvaluatedKey: { PK: "RECIPE#other", SK: "RECIPE" } })
      .resolvesOnce({ Items: [item({ id: "old", isFavorite: true }), item()], LastEvaluatedKey: {} });
    const result = await recipesRepo.list({ favorite: true, categoryId: "c1" });
    expect(result.map((r) => r.id)).toEqual(["new", "old"]);
    expect(result[0].coverImage).toBe("https://d2gmo95al03pdi.cloudfront.net/covers/old.png");
    expect(result[0]).not.toHaveProperty("PK");
    expect(result[0]).not.toHaveProperty("ingredients");
    const queries = ddb.commandCalls(QueryCommand).map((call) => call.args[0].input);
    expect(queries).toHaveLength(3);
    expect(queries[0]).toEqual({ TableName: "test-table", IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :kind", ExpressionAttributeValues: { ":kind": "RECIPE" },
      ScanIndexForward: false, ExclusiveStartKey: undefined });
    expect(queries[1].ExclusiveStartKey).toEqual(cursor);
    expect(queries.every((q) => !q.FilterExpression && !q.ConsistentRead)).toBe(true);
  });

  it("lists without filters and supports favorite false", async () => {
    ddb.on(QueryCommand).resolves({ Items: [item(), item({ id: "r2", isFavorite: true, coverImage: null })] });
    expect(await recipesRepo.list()).toHaveLength(2);
    expect((await recipesRepo.list({ favorite: false })).map((r) => r.id)).toEqual(["r1"]);
  });

  it("returns a full recipe without table metadata and preserves external URLs", async () => {
    ddb.on(GetCommand).resolves({ Item: item({ coverImage: "https://blog.example/a.jpg" }) });
    const result = await recipesRepo.getById("r1");
    expect(result.coverImage).toBe("https://blog.example/a.jpg");
    expect(result.ingredients).toEqual(input.ingredients);
    expect(result.photos).toEqual(input.photos);
    expect(result).not.toHaveProperty("GSI1SK");
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: "test-table", Key: { PK: "RECIPE#r1", SK: "RECIPE" }, ConsistentRead: true,
    });
  });

  it("throws a typed error when get misses", async () => {
    ddb.on(GetCommand).resolves({});
    await expect(recipesRepo.getById("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a recipe with generated id and timestamps without mutating input", async () => {
    ddb.on(PutCommand).resolves({});
    const before = structuredClone(input);
    const result = await recipesRepo.create(input);
    const stored = ddb.commandCalls(PutCommand)[0].args[0].input.Item!;
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.createdAt).toBe(stored.updatedAt);
    expect(stored.coverImage).toBe("covers/old.png");
    expect(stored.PK).toBe(`RECIPE#${result.id}`);
    expect(stored.GSI1SK).toBe(`${result.createdAt}#${result.id}`);
    expect(input).toEqual(before);
  });

  it("preserves migration overrides and null covers", async () => {
    ddb.on(PutCommand).resolves({});
    const overrides = { id: "original-id", createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2021-01-01T00:00:00.000Z" };
    const result = await recipesRepo.create({ ...input, coverImage: null }, overrides);
    expect(result).toMatchObject({ ...overrides, coverImage: null });
    expect(ddb.commandCalls(PutCommand)[0].args[0].input.Item).toMatchObject({
      PK: "RECIPE#original-id", GSI1SK: `${overrides.createdAt}#original-id`,
    });
  });

  it("updates only allowed defined fields and preserves stored cover keys", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: item() });
    const patch = { title: "Stew", notes: undefined, id: "injected", PK: "bad" };
    const result = await recipesRepo.update("r1", patch);
    const command = ddb.commandCalls(UpdateCommand)[0].args[0].input;
    expect(Object.values(command.ExpressionAttributeNames!)).toEqual(["title", "updatedAt"]);
    expect(command).toMatchObject({ ConditionExpression: "attribute_exists(PK)", ReturnValues: "ALL_OLD" });
    expect(result).toMatchObject({ id: "r1", title: "Stew", createdAt: item().createdAt });
    expect(result.coverImage).toBe("https://d2gmo95al03pdi.cloudfront.net/covers/old.png");
    expect(s3.calls()).toHaveLength(0);
  });

  it("deletes the previous raw key after cover replacement even when S3 fails", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: item() });
    s3.on(DeleteObjectCommand).rejects(new Error("S3 down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recipesRepo.update("r1", { coverImage: "covers/new.png" })).resolves.toMatchObject({
      coverImage: "https://d2gmo95al03pdi.cloudfront.net/covers/new.png",
    });
    expect(s3.commandCalls(DeleteObjectCommand)[0].args[0].input.Key).toBe("covers/old.png");
    expect(log).toHaveBeenCalled();
  });

  it("supports clearing a cover and skips cleanup for an unchanged cover", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: item() });
    expect((await recipesRepo.update("r1", { coverImage: null })).coverImage).toBeNull();
    expect(s3.commandCalls(DeleteObjectCommand)).toHaveLength(1);
    s3.resetHistory();
    await recipesRepo.update("r1", { coverImage: "covers/old.png" });
    expect(s3.calls()).toHaveLength(0);
  });

  it("updates favorite through a conditional patch without writing the cover URL", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: item() });
    expect((await recipesRepo.setFavorite("r1", true)).isFavorite).toBe(true);
    expect(Object.values(ddb.commandCalls(UpdateCommand)[0].args[0].input.ExpressionAttributeNames!))
      .toEqual(["isFavorite", "updatedAt"]);
  });

  it("maps missing updates and deletes to NotFoundError without S3 calls", async () => {
    ddb.on(UpdateCommand).rejects(conditional);
    ddb.on(DeleteCommand).rejects(conditional);
    await expect(recipesRepo.update("missing", {})).rejects.toBeInstanceOf(NotFoundError);
    await expect(recipesRepo.delete("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(s3.calls()).toHaveLength(0);
  });

  it("deletes the recipe before best-effort deletion of its old cover", async () => {
    ddb.on(DeleteCommand).resolves({ Attributes: item() });
    s3.on(DeleteObjectCommand).rejects(new Error("S3 down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recipesRepo.delete("r1")).resolves.toBeUndefined();
    expect(ddb.commandCalls(DeleteCommand)[0].args[0].input).toEqual({
      TableName: "test-table", Key: { PK: "RECIPE#r1", SK: "RECIPE" },
      ConditionExpression: "attribute_exists(PK)", ReturnValues: "ALL_OLD",
    });
    expect(s3.commandCalls(DeleteObjectCommand)[0].args[0].input.Key).toBe("covers/old.png");
  });

  it("skips external and absent cover cleanup", async () => {
    ddb.on(DeleteCommand).resolvesOnce({ Attributes: item({ coverImage: "https://blog.example/a.png" }) })
      .resolvesOnce({ Attributes: item({ coverImage: null }) });
    await recipesRepo.delete("r1");
    await recipesRepo.delete("r1");
    expect(s3.calls()).toHaveLength(0);
  });

  it("propagates database failures and does not run S3 cleanup", async () => {
    const error = new Error("DynamoDB unavailable");
    ddb.on(QueryCommand).rejects(error); ddb.on(GetCommand).rejects(error);
    ddb.on(PutCommand).rejects(error); ddb.on(UpdateCommand).rejects(error); ddb.on(DeleteCommand).rejects(error);
    await expect(recipesRepo.list()).rejects.toBe(error);
    await expect(recipesRepo.getById("r1")).rejects.toBe(error);
    await expect(recipesRepo.create(input)).rejects.toBe(error);
    await expect(recipesRepo.update("r1", { coverImage: null })).rejects.toBe(error);
    await expect(recipesRepo.delete("r1")).rejects.toBe(error);
    expect(s3.calls()).toHaveLength(0);
    expect(error).not.toBeInstanceOf(ConflictError);
  });
});
