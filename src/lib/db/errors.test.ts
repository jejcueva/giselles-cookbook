import { expect, it } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/db/errors";

it("creates a typed missing-item error", () => {
  const error = new NotFoundError("Recipe not found");
  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe("NotFoundError");
  expect(error.message).toBe("Recipe not found");
  expect(new NotFoundError().message).toBe("Not found");
});
it("creates a typed conflict error", () => {
  expect(new ConflictError()).toBeInstanceOf(Error);
  expect(new ConflictError().name).toBe("ConflictError");
  expect(new ConflictError().message).toBe("Conflict");
});
