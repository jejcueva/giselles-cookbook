import { describe, expect, it } from "vitest";
import { categoryIndex, categoryKey, categoryNameKey, recipeIndex, recipeKey } from "@/lib/db/keys";

describe("keys", () => {
  it("builds recipe primary keys", () => {
    expect(recipeKey("r1")).toEqual({ PK: "RECIPE#r1", SK: "RECIPE" });
  });
  it("orders recipes by creation time and then id", () => {
    expect(recipeIndex("r1", "2026-10-20T10:00:00.000Z")).toEqual({
      GSI1PK: "RECIPE", GSI1SK: "2026-10-20T10:00:00.000Z#r1",
    });
  });
  it("builds category primary and alphabetical index keys", () => {
    expect(categoryKey("c1")).toEqual({ PK: "CATEGORY#c1", SK: "CATEGORY" });
    expect(categoryIndex("Dinner")).toEqual({ GSI1PK: "CATEGORY", GSI1SK: "dinner" });
  });
  it("uses a separate case-insensitive uniqueness key", () => {
    expect(categoryNameKey("Dinner")).toEqual({ PK: "CATEGORYNAME#dinner", SK: "CATEGORYNAME" });
  });
});
