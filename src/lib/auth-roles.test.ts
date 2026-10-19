import { describe, expect, it } from "vitest";
import { isRecruiterBlockedPath, roleForAccount } from "@/lib/auth-roles";

describe("roleForAccount", () => {
  it("maps the recruiter account to the recruiter role", () => {
    expect(roleForAccount("recruiter")).toBe("recruiter");
  });

  it("maps every other account to owner", () => {
    expect(roleForAccount("gisellemyluv")).toBe("owner");
    expect(roleForAccount("test")).toBe("owner");
  });
});

describe("isRecruiterBlockedPath", () => {
  it.each([
    "/letter",
    "/letter/anything",
    "/birthday",
    "/birthday/scene-2",
    "/recipes/new",
    "/recipes/new/",
    "/recipes/abc-123/edit",
    "/recipes/abc-123/edit/",
  ])("blocks %s", (pathname) => {
    expect(isRecruiterBlockedPath(pathname)).toBe(true);
  });

  it.each(["/", "/recipes", "/recipes/abc-123", "/recipes/newer", "/favorites", "/settings"])(
    "allows %s",
    (pathname) => {
      expect(isRecruiterBlockedPath(pathname)).toBe(false);
    }
  );
});
