const rateLimit = require('express-rate-limit');

// In-memory store (express-rate-limit's default). Correct as long as the API
// runs as a single ECS task. If this ever scales to 2+ tasks, each task keeps
// its own counter, so the real effective limit multiplies by task count
// without erroring — it just silently gets weaker. At that point, swap the
// `store` option below for a Redis-backed store (e.g. rate-limit-redis) so
// all tasks share one counter. Nothing else about these limiters would need
// to change — this is the one seam that matters.

// Login: protects against credential-stuffing / brute-force attempts.
// Keyed by IP since there's no logged-in user yet at this point.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true, // adds RateLimit-* response headers
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Resume upload: protects Mistral API quota and SQS queue depth from a
// scripted flood of uploads. Keyed by authenticated user id (these routes
// sit behind authMiddleware, so req.user is always populated here) rather
// than IP, since a single user is the real unit of abuse to limit here.
const resumeUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // 15 upload attempts per user per hour — generous for real use, tight for abuse
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.id),
  message: { message: 'Too many resume upload attempts. Please try again later.' },
});

module.exports = { loginLimiter, resumeUploadLimiter };