/**
 * Failover Routes
 *
 * Failover notification config CRUD and log listing.
 *
 * @route GET    /api/v1/failover/configs  - List notification configs
 * @route POST   /api/v1/failover/configs  - Create notification config
 * @route PATCH  /api/v1/failover/configs/:id  - Toggle config enabled/disabled
 * @route DELETE /api/v1/failover/configs/:id  - Delete config
 * @route GET    /api/v1/failover/logs     - List failover log entries
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isGodAdminEmail } from '../../services/repositories/admin.repository.js';

const CreateConfigSchema = z.object({
  channel: z.enum(['webhook', 'email']),
  target: z.string().min(1),
  enabled: z.boolean().default(true),
});

const ToggleConfigSchema = z.object({
  enabled: z.boolean(),
});

export async function failoverRoutes(fastify: FastifyInstance) {
  const getRepo = () => (fastify as any).repositories.failover;

  /**
   * Admin authorization guard for mutation endpoints.
   * Returns true if the request should be blocked (403 was already sent).
   * God admins (ADMIN_EMAILS env) bypass the DB check.
   */
  const requireAdmin = async (request: any, reply: any): Promise<boolean> => {
    const jwtPayload = request.user || {};
    const email = jwtPayload.email;
    const userId = jwtPayload.sub;
    const adminRepo = (fastify as any).repositories.admin;

    if (!isGodAdminEmail(email) && !(await adminRepo.isAdmin(userId))) {
      reply.status(403).send({ error: 'Forbidden — admin required', code: 'FORBIDDEN' });
      return true;
    }
    return false;
  };

  // List notification configs
  fastify.get('/configs', async () => {
    const repo = getRepo();
    const configs = await repo.findConfigs();
    return { configs };
  });

  // Create notification config
  fastify.post('/configs', async (request, reply) => {
    const blocked = await requireAdmin(request, reply);
    if (blocked) return;

    const data = CreateConfigSchema.parse(request.body);
    const repo = getRepo();

    const config = await repo.insertConfig({
      channel: data.channel,
      target: data.target,
      enabled: data.enabled,
    });

    return reply.status(201).send(config);
  });

  // Toggle config
  fastify.patch<{ Params: { id: string } }>('/configs/:id', async (request, reply) => {
    const blocked = await requireAdmin(request, reply);
    if (blocked) return;

    const { id } = request.params;
    const { enabled } = ToggleConfigSchema.parse(request.body);
    const repo = getRepo();

    await repo.toggleConfig(id, enabled);
    return { id, enabled };
  });

  // Delete config
  fastify.delete<{ Params: { id: string } }>('/configs/:id', async (request, reply) => {
    const blocked = await requireAdmin(request, reply);
    if (blocked) return;

    const { id } = request.params;
    const repo = getRepo();

    await repo.deleteConfig(id);
    return { deleted: true };
  });

  // List failover logs
  fastify.get('/logs', async (request) => {
    const query = z.object({
      limit: z.coerce.number().min(1).max(200).default(50),
    }).parse(request.query);
    const repo = getRepo();

    const logs = await repo.findLogs(query.limit);
    return { logs };
  });
}
