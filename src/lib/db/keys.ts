export type TableKey = { PK: string; SK: string };
export type IndexKey = { GSI1PK: string; GSI1SK: string };

export function recipeKey(id: string): TableKey {
  return { PK: `RECIPE#${id}`, SK: "RECIPE" };
}
export function recipeIndex(id: string, createdAt: string): IndexKey {
  return { GSI1PK: "RECIPE", GSI1SK: `${createdAt}#${id}` };
}
export function categoryKey(id: string): TableKey {
  return { PK: `CATEGORY#${id}`, SK: "CATEGORY" };
}
export function categoryIndex(name: string): IndexKey {
  return { GSI1PK: "CATEGORY", GSI1SK: name.toLowerCase() };
}
export function categoryNameKey(name: string): TableKey {
  return { PK: `CATEGORYNAME#${name.toLowerCase()}`, SK: "CATEGORYNAME" };
}
