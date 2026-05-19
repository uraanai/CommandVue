/**
 * Exponential-backoff helper for WebSocket reconnection.
 *
 * Standard pattern: doubled delay per attempt up to a ceiling, with full
 * jitter to avoid the thundering-herd when a fleet of clients reconnects
 * simultaneously after a server restart.
 *
 *   delay(attempt) = random(0, min(baseMs * factor^attempt, maxMs))
 *
 * Defaults give: 0–1000, 0–2000, 0–4000, 0–8000, ..., capped at 0–30 000 ms.
 */
export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  factor?: number;
  jitter?: boolean;
}

export function calculateBackoff(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 1000, maxMs = 30000, factor = 2, jitter = true } = options;
  const ceiling = Math.min(baseMs * Math.pow(factor, Math.max(0, attempt)), maxMs);
  if (!jitter) {
    return Math.round(ceiling);
  }
  return Math.floor(Math.random() * ceiling);
}
