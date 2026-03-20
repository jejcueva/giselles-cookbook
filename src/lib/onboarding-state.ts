const LEGACY_USERNAME_ALIASES: Record<string, string[]> = {
  gisellemyluv: ["giselle"],
};

function onboardingKey(prefix: string, user: string): string {
  return `${prefix}${user}`;
}

function resolveLegacyCandidates(user: string): string[] {
  return [user, ...(LEGACY_USERNAME_ALIASES[user] ?? [])];
}

function readFlagWithLegacySupport(
  storage: Storage,
  prefix: string,
  user: string
): boolean {
  const candidates = resolveLegacyCandidates(user);
  for (const candidate of candidates) {
    const value = storage.getItem(onboardingKey(prefix, candidate));
    if (value === "true") {
      // Migrate legacy keys to the canonical username key.
      if (candidate !== user) {
        storage.setItem(onboardingKey(prefix, user), "true");
        storage.removeItem(onboardingKey(prefix, candidate));
      }
      return true;
    }
  }
  return false;
}

export function normalizeAccountUsername(rawUsername: string): string {
  const normalized = rawUsername.trim().toLowerCase();
  if (normalized === "giselle") {
    return "gisellemyluv";
  }
  return normalized;
}

export function hasCompletedQuiz(storage: Storage, user: string): boolean {
  return readFlagWithLegacySupport(storage, "has_completed_quiz_", user);
}

export function hasSeenBirthday(storage: Storage, user: string): boolean {
  return readFlagWithLegacySupport(storage, "has_seen_birthday_", user);
}

export function markQuizCompleted(storage: Storage, user: string): void {
  storage.setItem(onboardingKey("has_completed_quiz_", user), "true");
}

export function markBirthdaySeen(storage: Storage, user: string): void {
  storage.setItem(onboardingKey("has_seen_birthday_", user), "true");
}

export function clearOnboardingFlags(storage: Storage, user: string): void {
  storage.removeItem(onboardingKey("has_seen_birthday_", user));
  storage.removeItem(onboardingKey("has_completed_quiz_", user));
}
