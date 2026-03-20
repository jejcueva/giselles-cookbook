const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

type AttemptRecord = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptRecord>();

function now() {
  return Date.now();
}

export function isAuthRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.resetAt <= now()) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAuthAttempt(key: string): void {
  const entry = attempts.get(key);
  const current = now();

  if (!entry || entry.resetAt <= current) {
    attempts.set(key, { count: 1, resetAt: current + WINDOW_MS });
    return;
  }

  attempts.set(key, { ...entry, count: entry.count + 1 });
}

export function clearAuthAttempts(key: string): void {
  attempts.delete(key);
}

