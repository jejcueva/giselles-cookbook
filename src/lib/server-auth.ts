import { normalizeAccountUsername } from "@/lib/onboarding-state";

export type Account = "gisellemyluv" | "test" | "recruiter";

function resolvePassword(envName: string, devFallback: string): string {
  const value = process.env[envName];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${envName} is required in production`);
  }
  return devFallback;
}

function getCredentials(): Record<Account, string> {
  return {
    gisellemyluv: resolvePassword("AUTH_PASSWORD_GISELLEMYLUV", "01092026"),
    test: resolvePassword("AUTH_PASSWORD_TEST", "test"),
    recruiter: resolvePassword("AUTH_PASSWORD_RECRUITER", "recruiter"),
  };
}

function normalizePassword(user: Account, rawPassword: string): string {
  if (user === "gisellemyluv") return rawPassword.replace(/\D/g, "");
  return rawPassword.trim();
}

export function validateCredentials(rawUsername: string, rawPassword: string): Account | null {
  const username = normalizeAccountUsername(rawUsername) as Account;
  const credentials = getCredentials();
  const expectedPassword = credentials[username];
  if (!expectedPassword) return null;

  const provided = normalizePassword(username, rawPassword);
  const expected = normalizePassword(username, expectedPassword);
  if (provided !== expected) return null;
  return username;
}
