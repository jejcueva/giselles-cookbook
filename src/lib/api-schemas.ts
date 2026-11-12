import { z } from "zod";
import type { CreateCategoryInput, CreateRecipeInput, RecipePatch } from "@/lib/types";

export const idSchema = z.string().uuid();
const text = z.string().trim().min(1);
const nullableNumber = z.number().finite().nonnegative().nullable();
const coverKey = z.string().regex(/^covers\/[0-9a-f-]{36}\.(?:jpg|png|webp|heic)$/);
const httpsUrl = z.url({ protocol: /^https$/ }).max(2048);
const sourceUrl = z.url({ protocol: /^https?$/ }).max(2048);
const recipeFields = {
  title: text.max(200),
  ingredients: z.array(z.strictObject({ name: text.max(200), amount: z.string().max(80), unit: z.string().max(80) })).max(100),
  instructions: z.array(z.strictObject({ stepNumber: z.number().int().positive(), text: text.max(2000) })).max(100),
  notes: z.string().max(20000).nullable(), sourceUrl: sourceUrl.nullable(),
  cookTime: nullableNumber, prepTime: nullableNumber, servings: z.number().int().positive().nullable(),
  calories: nullableNumber, protein: nullableNumber, carbs: nullableNumber, fat: nullableNumber,
  isFavorite: z.boolean(), categoryIds: z.array(idSchema).max(100),
  tags: z.array(text.max(80)).max(100),
  photos: z.array(z.strictObject({ key: z.string().max(1024).regex(/^photos\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.(?:jpg|png|webp|heic)$/), sortOrder: z.number().int().nonnegative() })).max(100),
  coverImage: z.union([coverKey, httpsUrl]).nullable(),
};
const create = z.strictObject(recipeFields);
export const recipeCreateSchema: z.ZodType<CreateRecipeInput> = create;
export const recipePatchSchema: z.ZodType<RecipePatch> = create.partial().refine((value) => Object.keys(value).length > 0);
export const categoryCreateSchema: z.ZodType<CreateCategoryInput> = z.strictObject({ name: text.max(100), emoji: z.string().max(32).nullable() });
export const categoryPatchSchema = z.strictObject({ name: text.max(100).optional(), emoji: z.string().max(32).nullable().optional() })
  .refine((value) => value.name !== undefined || value.emoji !== undefined);
export const favoriteSchema = z.strictObject({ value: z.boolean() });
export const uploadSchema = z.strictObject({
  fileName: text.max(255), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});
export const recipeQuerySchema = z.strictObject({ favorite: z.literal("1").optional(), category: idSchema.optional() });
