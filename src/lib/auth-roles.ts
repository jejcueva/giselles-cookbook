export type SessionRole = "owner" | "recruiter";

export function roleForAccount(username: string): SessionRole {
  return username === "recruiter" ? "recruiter" : "owner";
}

export function isRecruiterBlockedPath(pathname: string): boolean {
  if (
    pathname === "/letter" ||
    pathname.startsWith("/letter/") ||
    pathname === "/birthday" ||
    pathname.startsWith("/birthday/") ||
    pathname === "/recipes/new" ||
    pathname.startsWith("/recipes/new/")
  ) {
    return true;
  }

  return /^\/recipes\/[^/]+\/edit(?:\/|$)/.test(pathname);
}
