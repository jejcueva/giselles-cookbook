import { randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { CreateRecipeInput, Recipe, RecipeOverrides, RecipePatch, RecipeSummary } from "@/lib/types";
import { db, tableName } from "@/lib/db/client";
import { NotFoundError } from "@/lib/db/errors";
import { recipeIndex, recipeKey, type IndexKey, type TableKey } from "@/lib/db/keys";
import { deleteObject, toPublicUrl } from "@/lib/storage/s3";

type RecipeItem = Recipe & TableKey & IndexKey;
type Filters = { favorite?: boolean; categoryId?: string };
const writable = [
  "title", "ingredients", "instructions", "notes", "sourceUrl", "cookTime", "prepTime", "servings",
  "calories", "protein", "carbs", "fat", "isFavorite", "categoryIds", "tags", "photos", "coverImage",
] as const satisfies readonly (keyof CreateRecipeInput)[];

function publicRecipe(item: RecipeItem): Recipe {
  const { PK, SK, GSI1PK, GSI1SK, ...recipe } = item;
  void PK; void SK; void GSI1PK; void GSI1SK;
  return { ...recipe, coverImage: recipe.coverImage === null ? null : toPublicUrl(recipe.coverImage) };
}

async function list(filters: Filters = {}): Promise<RecipeSummary[]> {
  let cursor: QueryCommandInput["ExclusiveStartKey"];
  let items: RecipeItem[] = [];
  do {
    const page = await db.send(new QueryCommand({
      TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "GSI1PK = :kind",
      ExpressionAttributeValues: { ":kind": "RECIPE" }, ScanIndexForward: false, ExclusiveStartKey: cursor,
    }));
    items = [...items, ...((page.Items ?? []) as RecipeItem[])];
    cursor = page.LastEvaluatedKey;
  } while (cursor && Object.keys(cursor).length > 0);
  return items.filter((recipe) =>
    (filters.favorite === undefined || recipe.isFavorite === filters.favorite) &&
    (filters.categoryId === undefined || recipe.categoryIds.includes(filters.categoryId))
  ).map((item) => {
    const { id, title, coverImage, isFavorite, categoryIds, createdAt } = publicRecipe(item);
    return { id, title, coverImage, isFavorite, categoryIds, createdAt };
  });
}

async function getById(id: string): Promise<Recipe> {
  const { Item } = await db.send(new GetCommand({ TableName: tableName, Key: recipeKey(id), ConsistentRead: true }));
  if (!Item) throw new NotFoundError("Recipe not found");
  return publicRecipe(Item as RecipeItem);
}

async function create(input: CreateRecipeInput, overrides: RecipeOverrides = {}): Promise<Recipe> {
  const now = new Date().toISOString();
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.createdAt ?? now;
  const item: RecipeItem = {
    ...input, id, createdAt, updatedAt: overrides.updatedAt ?? createdAt,
    ...recipeKey(id), ...recipeIndex(id, createdAt),
  };
  await db.send(new PutCommand({ TableName: tableName, Item: item }));
  return publicRecipe(item);
}

async function translateMissing<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      throw new NotFoundError("Recipe not found");
    }
    throw error;
  }
}

async function update(id: string, patch: RecipePatch): Promise<Recipe> {
  const changes = Object.fromEntries(writable.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]));
  const entries = Object.entries({ ...changes, updatedAt: new Date().toISOString() });
  const names = Object.fromEntries(entries.map(([key], index) => [`#f${index}`, key]));
  const values = Object.fromEntries(entries.map(([, value], index) => [`:v${index}`, value]));
  const result = await translateMissing(() => db.send(new UpdateCommand({
    TableName: tableName, Key: recipeKey(id), ConditionExpression: "attribute_exists(PK)",
    UpdateExpression: `SET ${entries.map((_, index) => `#f${index} = :v${index}`).join(", ")}`,
    ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: "ALL_OLD",
  })));
  const old = result.Attributes as RecipeItem;
  const next = { ...old, ...changes, updatedAt: entries[entries.length - 1][1] } as RecipeItem;
  if (old.coverImage && changes.coverImage !== undefined && old.coverImage !== changes.coverImage) {
    await deleteObject(old.coverImage);
  }
  return publicRecipe(next);
}

async function remove(id: string): Promise<void> {
  const result = await translateMissing(() => db.send(new DeleteCommand({
    TableName: tableName, Key: recipeKey(id), ConditionExpression: "attribute_exists(PK)", ReturnValues: "ALL_OLD",
  })));
  const old = result.Attributes as RecipeItem;
  if (old.coverImage) await deleteObject(old.coverImage);
}

async function setFavorite(id: string, value: boolean): Promise<Recipe> {
  return update(id, { isFavorite: value });
}

export const recipesRepo = { list, getById, create, update, delete: remove, setFavorite };
