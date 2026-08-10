import rateLimit from 'express-rate-limit';

// Rate limiting middleware for API requests, handled by express-rate-limit package.
// This middleware limits the number of requests a client can make to the API within
// a specified time window, helping to prevent abuse and ensure fair usage of the API.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting middleware for authentication requests
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
