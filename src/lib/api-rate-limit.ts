export function createApiLimiter(limit = 120, windowMs = 60000, now: () => number = Date.now) {
  let state = { count: 0, resetAt: 0 };
  return (): { allowed: boolean; retryAfter: number } => {
    const time = now();
    const current = time >= state.resetAt ? { count: 0, resetAt: time + windowMs } : state;
    if (current.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - time) / 1000)) };
    state = { ...current, count: current.count + 1 };
    return { allowed: true, retryAfter: 0 };
  };
}
export const consumeApiLimit = createApiLimiter();
