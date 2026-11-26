/**
 * In-memory sliding-window rate limiter for public ticket submission.
 * Limits ticket creation requests per IP address to prevent spam or abuse.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window
const MAX_REQUESTS = 10; // Max 10 ticket submissions per 15 minutes per IP

// Map of IP -> Array of request timestamps
const requestsByIp = new Map();

// Periodic cleanup every 5 minutes to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestsByIp.entries()) {
    const valid = timestamps.filter((time) => now - time < WINDOW_MS);
    if (valid.length === 0) {
      requestsByIp.delete(ip);
    } else {
      requestsByIp.set(ip, valid);
    }
  }
}, 5 * 60 * 1000);

// Allow Node process to exit cleanly if this timer is active
if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

/**
 * Express middleware for rate limiting public ticket submission.
 */
export function raiseTicketRateLimiter(req, res, next) {
  // Extract client IP address (supporting X-Forwarded-For headers if behind proxy)
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    req.ip ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  const now = Date.now();
  let timestamps = requestsByIp.get(clientIp) || [];

  // Filter timestamps within current window
  timestamps = timestamps.filter((time) => now - time < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    const earliest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - earliest)) / 1000));
    const retryAfterMinutes = Math.ceil(retryAfterSec / 60);

    res.set('Retry-After', String(retryAfterSec));
    res.set('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Reset', String(Math.ceil((earliest + WINDOW_MS) / 1000)));

    return res.status(429).json({
      success: false,
      error: `Too many tickets submitted from this network. Please wait ${retryAfterMinutes} minute(s) before submitting another ticket.`,
      retryAfterSeconds: retryAfterSec,
    });
  }

  // Record this request
  timestamps.push(now);
  requestsByIp.set(clientIp, timestamps);

  // Set rate limit headers
  res.set('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - timestamps.length)));
  res.set('X-RateLimit-Reset', String(Math.ceil((timestamps[0] + WINDOW_MS) / 1000)));

  next();
}

/**
 * Resets the in-memory rate limiter tracking (used for testing purposes).
 */
export function resetRateLimits() {
  requestsByIp.clear();
}
