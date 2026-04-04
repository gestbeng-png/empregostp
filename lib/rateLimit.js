/**
 * Simple in-memory rate limiter
 * Tracks requests by IP address
 */

const requestLog = {};
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5; // 5 requests per minute

/**
 * Check if request should be rate limited
 * @param {string} ip - Client IP address
 * @param {number} limit - Max requests per window (default 5)
 * @returns {boolean} - true if within limit, false if exceeded
 */
export function checkRateLimit(ip, limit = MAX_REQUESTS) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Initialize or clean old requests
  if (!requestLog[ip]) {
    requestLog[ip] = [];
  }

  // Remove requests outside the window
  requestLog[ip] = requestLog[ip].filter(timestamp => timestamp > windowStart);

  // Check if limit exceeded
  if (requestLog[ip].length >= limit) {
    return false;
  }

  // Add current request
  requestLog[ip].push(now);
  return true;
}

/**
 * Middleware to apply rate limiting to API routes
 * Usage in API: import { rateLimitMiddleware } from '../lib/rateLimit';
 * Then: rateLimitMiddleware(req, res, handler)
 */
export function rateLimitMiddleware(req, res, handler, limit = MAX_REQUESTS) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
             req.headers['x-real-ip'] || 
             req.socket?.remoteAddress || 
             'unknown';

  if (!checkRateLimit(ip, limit)) {
    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Maximum ${limit} requests per minute.`,
      retryAfter: 60
    });
  }

  return handler();
}

/**
 * Get current request count for an IP (for debugging)
 */
export function getRequestCount(ip) {
  if (!requestLog[ip]) return 0;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  return requestLog[ip].filter(timestamp => timestamp > windowStart).length;
}

/**
 * Reset rate limit for an IP (for testing)
 */
export function resetRateLimit(ip) {
  if (requestLog[ip]) {
    delete requestLog[ip];
  }
}

/**
 * Reset all rate limits (for testing)
 */
export function resetAllRateLimits() {
  Object.keys(requestLog).forEach(key => delete requestLog[key]);
}
