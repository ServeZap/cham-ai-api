/**
 * Authentication Hook - Cham.ai
 *
 * Verifies Supabase JWTs using @fastify/jwt.
 * Extracts user info from Supabase JWT payload (sub, email, app_metadata.tenant_id).
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Auth paths that skip JWT verification (public endpoints / webhooks)
 */
export const authConfig = {
  skipPaths: [
    '/api/health',
    '/api/ready',
    '/api/metrics',
    '/docs',
    '/api/v1/calls/inbound', // Twilio webhook
    '/api/v1/voice/converse', // Public conversational endpoint
    '/api/v1/demo/requests', // Landing page demo request (public)
  ],
};

/**
 * Extract user UUID from Supabase JWT payload
 */
export function getUserId(payload: any): string | null {
  return payload?.sub || null;
}

/**
 * Extract email from Supabase JWT payload
 */
export function getUserEmail(payload: any): string | null {
  return payload?.email || null;
}

/**
 * Extract tenant_id from Supabase JWT app_metadata
 */
export function getTenantId(payload: any): string | null {
  return payload?.app_metadata?.tenant_id || null;
}

/**
 * Check if user has a specific role
 */
export function hasRole(payload: any, role: string): boolean {
  const userRole = payload?.app_metadata?.role || payload?.user_role;
  return userRole === role;
}

/**
 * Auth hook that verifies Supabase JWT tokens using Fastify's built-in JWT verification.
 */
export async function authHook(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for configured paths (uses startsWith for path matching)
  if (authConfig.skipPaths.some((path) => request.url?.startsWith(path))) {
    return;
  }

  try {
    // Use Fastify's built-in JWT verification (from @fastify/jwt plugin)
    // The JWT secret is set to SUPABASE_JWT_SECRET so Supabase tokens are valid
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
}

/**
 * Verify Twilio webhook signature
 */
export function requireTwilioSignature(request: any): boolean {
  const signature = request.headers['x-twilio-signature'];
  const url = request.url;
  // TODO: Implement actual Twilio signature verification
  return !!signature;
}
