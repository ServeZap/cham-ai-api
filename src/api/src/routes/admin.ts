/**
 * Admin Routes
 *
 * Admin-only endpoints for system management.
 *
 * @route GET  /api/v1/admin/is-admin     - Check if user is admin
 * @route GET  /api/v1/admin/overview     - System overview (admin only)
 * @route GET  /api/v1/admin/users        - List users (admin only)
 * @route POST /api/v1/admin/api-keys     - Generate API key (admin only)
 */

import { FastifyInstance } from 'fastify';
import { isGodAdminEmail } from '../../services/repositories/admin.repository.js';
import { GenerateApiKeySchema } from '../../../../contracts/src/index.js';

export async function adminRoutes(fastify: FastifyInstance) {
  // Check if user is admin
  fastify.get('/is-admin', async (request, reply) => {
    const jwtPayload = (request as any).user || {};
    const userId = jwtPayload.sub;
    const email = jwtPayload.email;
    const repo = (fastify as any).repositories.admin;

    // God admin check (email-based, no DB needed)
    if (isGodAdminEmail(email)) {
      return { is_admin: true, god: true };
    }

    const isAdmin = await repo.isAdmin(userId);
    return { is_admin: isAdmin };
  });

  // System overview
  fastify.get('/overview', async (request, reply) => {
    const jwtPayload = (request as any).user || {};
    const userId = jwtPayload.sub;
    const email = jwtPayload.email;
    const repo = (fastify as any).repositories.admin;

    if (!isGodAdminEmail(email) && !(await repo.isAdmin(userId))) {
      return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    const overview = await repo.getOverview();
    return overview;
  });

  // List users
  fastify.get('/users', async (request, reply) => {
    const jwtPayload = (request as any).user || {};
    const userId = jwtPayload.sub;
    const email = jwtPayload.email;
    const repo = (fastify as any).repositories.admin;

    if (!isGodAdminEmail(email) && !(await repo.isAdmin(userId))) {
      return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    const users = await repo.getUsers();
    return { users };
  });

  // Generate API key
  fastify.post('/api-keys', async (request, reply) => {
    const jwtPayload = (request as any).user || {};
    const userId = jwtPayload.sub;
    const email = jwtPayload.email;
    const repo = (fastify as any).repositories.admin;

    if (!isGodAdminEmail(email) && !(await repo.isAdmin(userId))) {
      return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    const { label } = GenerateApiKeySchema.parse(request.body);
    const apiKey = await repo.generateApiKey(userId, label);

    return reply.status(201).send(apiKey);
  });
}
