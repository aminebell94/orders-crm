/**
 * Rate Limiting Middleware
 *
 * In-memory rate limiter that tracks login attempts by IP + email combination.
 * Configurable via environment variables:
 *   - MAX_LOGIN_ATTEMPTS (default: 5)
 *   - ACCOUNT_LOCK_DURATION (default: 15 minutes)
 *
 * Returns 429 with Retry-After header when threshold is exceeded.
 * Always includes X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers.
 *
 * Validates: Requirements 7.1, 7.2
 */

interface AttemptRecord {
  count: number;
  firstAttempt: number;
}

/** In-memory store keyed by "ip:email" */
const attempts: Map<string, AttemptRecord> = new Map();

/** Interval handle for periodic cleanup */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Build a rate-limit key from the request IP and the login identifier (email).
 */
function buildKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase().trim()}`;
}

export default (config, { strapi }) => {
  const maxAttempts: number = parseInt(
    process.env.MAX_LOGIN_ATTEMPTS ?? '5',
    10,
  );
  const lockDurationMinutes: number = parseInt(
    process.env.ACCOUNT_LOCK_DURATION ?? '15',
    10,
  );
  const windowMs: number = lockDurationMinutes * 60 * 1000;

  // Start periodic cleanup of expired entries (every 5 minutes)
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of attempts) {
        if (now - record.firstAttempt > windowMs) {
          attempts.delete(key);
        }
      }
    }, 5 * 60 * 1000);

    // Allow the process to exit without waiting for the interval
    if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
      cleanupInterval.unref();
    }
  }

  return async (ctx, next) => {
    const email: string | undefined = ctx.request.body?.identifier;

    // If there's no identifier in the body, this isn't a login attempt — pass through
    if (!email) {
      await next();
      return;
    }

    const ip: string = ctx.request.ip;
    const key = buildKey(ip, email);
    const now = Date.now();

    let record = attempts.get(key);

    // If the record exists but the window has expired, reset it
    if (record && now - record.firstAttempt > windowMs) {
      attempts.delete(key);
      record = undefined;
    }

    const currentCount = record?.count ?? 0;
    const resetTime = record
      ? record.firstAttempt + windowMs
      : now + windowMs;

    // Check if the threshold has been exceeded
    if (currentCount >= maxAttempts) {
      const retryAfterSeconds = Math.ceil((resetTime - now) / 1000);

      ctx.set('X-RateLimit-Limit', String(maxAttempts));
      ctx.set('X-RateLimit-Remaining', '0');
      ctx.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
      ctx.set('Retry-After', String(retryAfterSeconds));

      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequestsError',
          message: 'Too many login attempts. Please try again later.',
        },
      };
      return;
    }

    // Set rate-limit headers before calling next
    const remaining = maxAttempts - currentCount - 1;
    ctx.set('X-RateLimit-Limit', String(maxAttempts));
    ctx.set('X-RateLimit-Remaining', String(Math.max(remaining, 0)));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    await next();

    // After the downstream handler runs, check if the login failed (status 400)
    // and increment the counter accordingly
    if (ctx.status === 400) {
      const existing = attempts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        attempts.set(key, { count: 1, firstAttempt: now });
      }

      // Update remaining header after increment
      const updatedRecord = attempts.get(key)!;
      const updatedRemaining = maxAttempts - updatedRecord.count;
      ctx.set('X-RateLimit-Remaining', String(Math.max(updatedRemaining, 0)));
    } else if (ctx.status === 200) {
      // Successful login — clear the record for this key
      attempts.delete(key);
      ctx.set('X-RateLimit-Remaining', String(maxAttempts));
    }
  };
};

/**
 * Exported for testing: clear all tracked attempts.
 */
export function clearAttempts(): void {
  attempts.clear();
}

/**
 * Exported for testing: get the current attempts map.
 */
export function getAttempts(): Map<string, AttemptRecord> {
  return attempts;
}
