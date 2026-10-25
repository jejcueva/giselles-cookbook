import { randomUUID } from "node:crypto";
import { GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand, type QueryCommandInput, type TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import type { Category, CreateCategoryInput } from "@/lib/types";
import { db, tableName } from "@/lib/db/client";
import { ConflictError, NotFoundError } from "@/lib/db/errors";
import { categoryIndex, categoryKey, categoryNameKey } from "@/lib/db/keys";
import { recipesRepo } from "@/lib/db/recipes-repo";

function domain(item: Record<string, unknown>): Category {
  return { id: item.id as string, name: item.name as string, emoji: item.emoji as string | null, createdAt: item.createdAt as string };
}
function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required");
  return trimmed;
}

async function list(): Promise<Category[]> {
  let cursor: QueryCommandInput["ExclusiveStartKey"];
  let categories: Category[] = [];
  do {
    const page = await db.send(new QueryCommand({
      TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "GSI1PK = :kind",
      ExpressionAttributeValues: { ":kind": "CATEGORY" }, ScanIndexForward: true, ExclusiveStartKey: cursor,
    }));
    categories = [...categories, ...(page.Items ?? []).map(domain)];
    cursor = page.LastEvaluatedKey;
  } while (cursor && Object.keys(cursor).length > 0);
  return categories;
}

async function getById(id: string): Promise<Category> {
  const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: categoryKey(id), ConsistentRead: true }));
  if (!Item) throw new NotFoundError("Category not found");
  return domain(Item);
}

async function transact(items: TransactWriteCommandInput["TransactItems"], conflicts: number[], id?: string): Promise<void> {
  try {
    await db.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "TransactionCanceledException") throw error;
    const reasons = (error as Error & { CancellationReasons?: { Code?: string }[] }).CancellationReasons ?? [];
    if (conflicts.some((index) => reasons[index]?.Code === "ConditionalCheckFailed")) {
      throw new ConflictError("Category name or id already exists");
    }
    if (id && reasons[0]?.Code === "ConditionalCheckFailed") {
      await getById(id);
      throw new ConflictError("Category changed; reload and try again");
    }
    throw error;
  }
}

async function create(input: CreateCategoryInput, overrides: { id?: string } = {}): Promise<Category> {
  const name = cleanName(input.name);
  const id = overrides.id ?? randomUUID();
  const category: Category = { id, name, emoji: input.emoji, createdAt: new Date().toISOString() };
  await transact([
    { Put: { TableName: tableName, Item: categoryNameKey(name), ConditionExpression: "attribute_not_exists(PK)" } },
    { Put: { TableName: tableName, Item: { ...category, ...categoryKey(id), ...categoryIndex(name) }, ConditionExpression: "attribute_not_exists(PK)" } },
  ], [0, 1]);
  return category;
}

async function rename(id: string, inputName: string): Promise<Category> {
  const name = cleanName(inputName);
  const current = await getById(id);
  const update = { Update: {
    TableName: tableName, Key: categoryKey(id), ConditionExpression: "attribute_exists(PK) AND #name = :old",
    UpdateExpression: "SET #name = :name, GSI1SK = :sort",
    ExpressionAttributeNames: { "#name": "name" },
    ExpressionAttributeValues: { ":name": name, ":sort": name.toLowerCase(), ":old": current.name },
  } };
  const sameKey = current.name.toLowerCase() === name.toLowerCase();
  const items = sameKey ? [update] : [
    update,
    { Delete: { TableName: tableName, Key: categoryNameKey(current.name) } },
    { Put: { TableName: tableName, Item: categoryNameKey(name), ConditionExpression: "attribute_not_exists(PK)" } },
  ];
  await transact(items, sameKey ? [] : [2], id);
  return { ...current, name };
}

async function setEmoji(id: string, emoji: string | null): Promise<Category> {
  try {
    const { Attributes } = await db.send(new UpdateCommand({
      TableName: tableName, Key: categoryKey(id), ConditionExpression: "attribute_exists(PK)",
      UpdateExpression: "SET emoji = :emoji", ExpressionAttributeValues: { ":emoji": emoji }, ReturnValues: "ALL_NEW",
    }));
    return domain(Attributes!);
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      throw new NotFoundError("Category not found");
    }
    throw error;
  }
}

async function remove(id: string): Promise<void> {
  const current = await getById(id);
  await transact([
    { Delete: { TableName: tableName, Key: categoryKey(id),
      ConditionExpression: "attribute_exists(PK) AND #name = :old",
      ExpressionAttributeNames: { "#name": "name" }, ExpressionAttributeValues: { ":old": current.name } } },
    { Delete: { TableName: tableName, Key: categoryNameKey(current.name) } },
  ], [], id);
  const recipes = await recipesRepo.list({ categoryId: id });
  for (const recipe of recipes) {
    try {
      await recipesRepo.update(recipe.id, { categoryIds: recipe.categoryIds.filter((categoryId) => categoryId !== id) });
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
}

export const categoriesRepo = { list, getById, create, rename, setEmoji, delete: remove };
