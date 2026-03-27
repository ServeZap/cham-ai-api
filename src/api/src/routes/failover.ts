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

  // List notification configs
  fastify.get('/configs', async () => {
    const repo = getRepo();
    const configs = await repo.findConfigs();
    return { configs };
  });

  // Create notification config
  fastify.post('/configs', async (request, reply) => {
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
    const { id } = request.params;
    const { enabled } = ToggleConfigSchema.parse(request.body);
    const repo = getRepo();

    await repo.toggleConfig(id, enabled);
    return { id, enabled };
  });

  // Delete config
  fastify.delete<{ Params: { id: string } }>('/configs/:id', async (request, reply) => {
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
