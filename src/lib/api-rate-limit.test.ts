import { expect, it } from "vitest";
import { createApiLimiter } from "@/lib/api-rate-limit";

it("allows the limit and rejects the next request", () => {
  const consume = createApiLimiter(2, 60000, () => 0);
  expect(consume().allowed).toBe(true);
  expect(consume().allowed).toBe(true);
  expect(consume()).toEqual({ allowed: false, retryAfter: 60 });
});
it("starts a fresh window at expiry", () => {
  let time = 0;
  const consume = createApiLimiter(1, 60000, () => time);
  consume(); time = 59500;
  expect(consume()).toEqual({ allowed: false, retryAfter: 1 });
  time = 60000;
  expect(consume().allowed).toBe(true);
});
it("keeps independent limiter instances and default configuration", () => {
  const first = createApiLimiter(1);
  const second = createApiLimiter();
  first();
  expect(first().allowed).toBe(false);
  expect(second().allowed).toBe(true);
});
