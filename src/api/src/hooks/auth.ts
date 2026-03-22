/**
 * Authentication Hook - Cham.ai
 *
 * Uses shared auth configuration with Fastify's built-in JWT verification.
 * This maintains compatibility with existing tests that expect request.jwtVerify().
 */

import { getTenantId, getUserId, hasRole } from '@servezap/shared/api/auth';

/**
 * Cham.ai auth hook configuration
 */
export const authConfig = {
  secret: process.env.JWT_SECRET || 'change-me-in-production',
  skipPaths: [
    '/api/health',
    '/api/ready',
    '/api/metrics',
    '/api/docs',
    '/api/v1/calls/inbound', // Twilio webhook
    '/api/v1/voice/converse', // Public conversational endpoint
  ],
};

/**
 * Auth hook that uses Fastify's built-in JWT verification
 * Maintains backward compatibility with existing tests
 */
export async function authHook(request: any, reply: any) {
  // Skip auth for configured paths (uses startsWith for path matching)
  if (authConfig.skipPaths.some((path) => request.url?.startsWith(path))) {
    return;
  }

  try {
    // Use Fastify's built-in JWT verification (from @fastify/jwt plugin)
    await request.jwtVerify();
  } catch (err) {
    // Send error directly (matches old behavior)
    reply.send(err);
  }
}

// Re-export shared utilities for convenience
export { getTenantId, getUserId, hasRole };

/**
 * Cham.ai specific auth helpers
 */
export function requireTwilioSignature(request: any): boolean {
  const signature = request.headers['x-twilio-signature'];
  const url = request.url;
  // TODO: Implement Twilio signature verification
  return !!signature;
}
