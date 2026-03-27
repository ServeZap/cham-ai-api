/**
 * Sessions Routes
 *
 * Session and context management with real database operations.
 *
 * @route GET    /api/v1/sessions          - List sessions
 * @route POST   /api/v1/sessions          - Create new session
 * @route GET    /api/v1/sessions/:id      - Get session by ID
 * @route PUT    /api/v1/sessions/:id      - Update session
 * @route DELETE /api/v1/sessions/:id      - Delete session
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const SessionSchema = z.object({
  assistant_id: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

const UpdateSessionSchema = z.object({
  status: z.string().optional(),
  context: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const ListSessionsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  assistant_id: z.string().uuid().optional(),
  status: z.string().optional(),
});

export async function sessionsRoutes(fastify: FastifyInstance) {
  // List sessions
  fastify.get('/', async (request, reply) => {
    const query = ListSessionsSchema.parse(request.query);
    const jwtPayload = (request as any).user || {};
    const repo = (fastify as any).repositories.sessions;

    const result = await repo.findAll({
      tenant_id: jwtPayload.app_metadata?.tenant_id || '',
      assistant_id: query.assistant_id,
      user_id: jwtPayload.sub,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });

    return {
      sessions: result.sessions,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: Math.ceil(result.total / query.limit),
      },
    };
  });

  // Create new session
  fastify.post('/', async (request, reply) => {
    const data = SessionSchema.parse(request.body);
    const jwtPayload = (request as any).user || {};
    const repo = (fastify as any).repositories.sessions;

    const session = await repo.create({
      tenant_id: jwtPayload.app_metadata?.tenant_id || '',
      assistant_id: data.assistant_id || null,
      user_id: jwtPayload.sub,
      metadata: data.metadata,
    });

    return reply.status(201).send(session);
  });

  // Get session by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.sessions;
    const session = await repo.findById(id);

    if (!session) {
      return reply.status(404).send({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    return session;
  });

  // Update session
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const data = UpdateSessionSchema.parse(request.body);
    const repo = (fastify as any).repositories.sessions;

    const session = await repo.update(id, data);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    return session;
  });

  // Delete session
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.sessions;
    const deleted = await repo.delete(id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    return reply.status(204).send();
  });
}
