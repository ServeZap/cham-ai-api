/**
 * Authentication Hook - Cham.ai
 *
 * Verifies Supabase JWTs using @fastify/jwt.
 * Extracts user info from Supabase JWT payload (sub, email, app_metadata.tenant_id).
 */

import { createHmac } from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Auth paths that skip JWT verification (public endpoints / webhooks)
 *
 * SECURITY: /api/v1/voice/converse was REMOVED — it consumes OpenAI credits
 * and must require authentication (cost governance principle).
 */
export const authConfig = {
  skipPaths: [
    '/api/health',
    '/api/ready',
    '/api/metrics',
    '/docs',
    '/api/v1/calls/inbound', // Twilio webhook (signature verified in route)
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
 * Verify Twilio webhook signature using HMAC-SHA1.
 *
 * Twilio signs the full URL concatenated with sorted POST parameters
 * using the Auth Token as the HMAC key.
 *
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): boolean {
  if (!authToken || !signature) {
    return false;
  }

  // Exclude the signature itself and empty values from the sorted params
  const data = Object.entries(params)
    .filter(([key]) => key !== 'X-Twilio-Signature')
    .filter(([, value]) => value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${value}`)
    .join('');

  const payload = `${url}${data}`;
  const expected = createHmac('sha1', authToken).update(payload).digest('base64');

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}
