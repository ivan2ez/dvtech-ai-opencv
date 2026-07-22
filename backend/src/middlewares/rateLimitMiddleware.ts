import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for public endpoints.
 * Limits each IP to 100 requests per 15-minute window.
 * Returns HTTP 429 when the limit is exceeded.
 */
export const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per window per IP
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    status: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});
