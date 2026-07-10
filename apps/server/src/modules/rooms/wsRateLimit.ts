// Simple fixed-window limiter for inbound socket events. Per-process (like
// games/presence's in-memory era before Phase 3) is fine here: the cost of
// under-counting slightly right after a failover is a client getting a few
// extra requests through, not a correctness issue — unlike room state,
// there's nothing to keep consistent across instances.
const WINDOW_MS = 10_000;
const MAX_EVENTS_PER_WINDOW = 30;

const hits = new Map<string, { count: number; windowStart: number }>();

export function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const entry = hits.get(socketId);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(socketId, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_EVENTS_PER_WINDOW;
}

export function clearRateLimit(socketId: string): void {
  hits.delete(socketId);
}
