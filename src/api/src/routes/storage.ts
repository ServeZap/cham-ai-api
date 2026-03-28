/**
 * Storage Routes — Signed URL generation for call-assets bucket
 *
 * Replaces the Supabase Edge Function storage-signed-url.
 * Validates JWT auth and tenant isolation before signing URLs.
 *
 * @route POST /api/v1/storage/signed-url   — Single signed URL
 * @route POST /api/v1/storage/signed-urls  — Batch signed URLs
 */

import { FastifyInstance } from 'fastify';
import { getTenantId } from '../hooks/auth.js';
import { isGodAdminEmail } from '../../services/repositories/admin.repository.js';
import {
  SignedUrlSchema,
  SignedUrlsSchema,
} from '../../../../contracts/src/index.js';

// ── Helpers ──────────────────────────────────────────────────────

const BUCKET_NAME = 'call-assets';

/**
 * Generate a Supabase Storage signed URL via REST API.
 * Uses the service_role key so the backend can sign on behalf of any user.
 */
async function createSupabaseSignedUrl(
  path: string,
  expiresIn: number
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Storage not configured');
  }

  // Supabase Storage RPC endpoint for creating signed URLs
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/create_signed_url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        bucket_name: BUCKET_NAME,
        path,
        expires_in: expiresIn,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || 'Failed to create signed URL');
  }

  const data = await response.json();
  return data.signed_url || data.signedUrl || data;
}

// ── Routes ───────────────────────────────────────────────────────

export async function storageRoutes(fastify: FastifyInstance) {
  // Single signed URL
  fastify.post('/signed-url', async (request, reply) => {
    const body = SignedUrlSchema.parse(request.body);
    const { path, expiresIn } = body;

    // Get tenant_id from JWT to enforce isolation
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const godAdmin = isGodAdminEmail(jwtPayload.email);

    if (!tenantId && !godAdmin) {
      return reply.status(403).send({
        error: 'Tenant ID not found in token',
        code: 'TENANT_NOT_FOUND',
      });
    }

    // Security: path must start with the user's tenant_id
    // God admins bypass tenant isolation
    const normalizedPath = path.replace(/^\/+/, '');
    if (!godAdmin && tenantId && !normalizedPath.startsWith(tenantId)) {
      return reply.status(403).send({
        error: 'Access denied — path does not belong to your tenant',
        code: 'FORBIDDEN',
      });
    }

    try {
      const signedUrl = await createSupabaseSignedUrl(normalizedPath, expiresIn);
      return { signedUrl, path, expiresIn };
    } catch (err: any) {
      request.log.error({ err, path }, 'Failed to create signed URL');
      return reply.status(500).send({
        error: 'Failed to generate signed URL',
        code: 'STORAGE_ERROR',
      });
    }
  });

  // Batch signed URLs
  fastify.post('/signed-urls', async (request, reply) => {
    const body = SignedUrlsSchema.parse(request.body);
    const { paths, expiresIn } = body;

    // Get tenant_id from JWT to enforce isolation
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const godAdmin = isGodAdminEmail(jwtPayload.email);

    if (!tenantId && !godAdmin) {
      return reply.status(403).send({
        error: 'Tenant ID not found in token',
        code: 'TENANT_NOT_FOUND',
      });
    }

    // Validate all paths belong to this tenant
    // God admins bypass tenant isolation
    for (const rawPath of paths) {
      const normalizedPath = rawPath.replace(/^\/+/, '');
      if (!godAdmin && tenantId && !normalizedPath.startsWith(tenantId)) {
        return reply.status(403).send({
          error: 'Access denied — path does not belong to your tenant',
          code: 'FORBIDDEN',
        });
      }
    }

    try {
      const signedUrls = await Promise.all(
        paths.map(async (rawPath) => {
          const normalizedPath = rawPath.replace(/^\/+/, '');
          try {
            const signedUrl = await createSupabaseSignedUrl(normalizedPath, expiresIn);
            return { path: rawPath, signedUrl };
          } catch {
            return { path: rawPath, signedUrl: null };
          }
        })
      );
      return { signedUrls };
    } catch (err: any) {
      request.log.error({ err }, 'Failed to create signed URLs');
      return reply.status(500).send({
        error: 'Failed to generate signed URLs',
        code: 'STORAGE_ERROR',
      });
    }
  });
}
