/**
 * Users Routes
 *
 * Current-user operations (tenant lookup, profile management).
 *
 * @route GET    /api/v1/users/tenant-id   - Get tenant_id for the authenticated user
 * @route DELETE /api/v1/users/profile     - Delete own profile (and sign out)
 */

import { FastifyInstance } from 'fastify';

export async function usersRoutes(fastify: FastifyInstance) {
  // Get tenant_id for current user
  fastify.get('/tenant-id', async (request, reply) => {
    const jwtPayload = (request as any).user || {};
    const userId = jwtPayload.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    }

    const db = (fastify as any).pg;
    const result = await db.query(
      `SELECT tenant_id FROM profiles WHERE user_id = $1`,
      [userId]
    );

    const row = result.rows[0];
    if (!row) {
      return reply.status(404).send({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' });
    }

    return { tenant_id: row.tenant_id };
  });

  // Delete own profile
  fastify.delete('/profile', async (request, reply) => {
    const jwtPayload = (request as any).user || {};
    const userId = jwtPayload.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    }

    const db = (fastify as any).pg;
    await db.query(
      `DELETE FROM profiles WHERE user_id = $1`,
      [userId]
    );

    return { deleted: true };
  });
}
