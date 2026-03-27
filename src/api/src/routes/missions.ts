/**
 * Missions Routes
 *
 * CRUD + lifecycle operations for UI automation missions.
 *
 * @route GET    /api/v1/missions              - List missions
 * @route POST   /api/v1/missions              - Create mission
 * @route GET    /api/v1/missions/:id          - Get mission
 * @route PUT    /api/v1/missions/:id          - Update mission
 * @route DELETE /api/v1/missions/:id          - Delete mission
 * @route POST   /api/v1/missions/:id/pause    - Pause mission
 * @route POST   /api/v1/missions/:id/resume   - Resume mission
 * @route POST   /api/v1/missions/:id/cancel   - Cancel mission
 * @route POST   /api/v1/missions/:id/screenshot - Capture screenshot
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CreateMissionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  target_url: z.string().url(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const UpdateMissionSchema = z.object({
  mission_name: z.string().optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  target_url: z.string().nullable().optional(),
});

export async function missionsRoutes(fastify: FastifyInstance) {
  // List missions
  fastify.get('/', async (request, reply) => {
    const { page = '1', limit = '50', status } = request.query as any;
    const jwtPayload = (request as any).user || {};
    const repo = (fastify as any).repositories.missions;

    const result = await repo.findAll({
      tenant_id: jwtPayload.app_metadata?.tenant_id,
      status: status || undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    return {
      missions: result.missions,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit, 10)),
      },
    };
  });

  // Create mission
  fastify.post('/', async (request, reply) => {
    const data = CreateMissionSchema.parse(request.body);
    const jwtPayload = (request as any).user || {};
    const repo = (fastify as any).repositories.missions;

    const mission = await repo.create({
      user_id: jwtPayload.sub,
      tenant_id: jwtPayload.app_metadata?.tenant_id,
      mission_name: data.name,
      description: data.description,
      target_url: data.target_url,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      status: 'queued',
      steps: [],
      logs: [],
      progress: 0,
    });

    return reply.status(201).send(mission);
  });

  // Get mission
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.missions;
    const mission = await repo.findById(id);

    if (!mission) {
      return reply.status(404).send({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
    }

    return mission;
  });

  // Update mission
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const data = UpdateMissionSchema.parse(request.body);
    const repo = (fastify as any).repositories.missions;

    const mission = await repo.update(id, data);
    if (!mission) {
      return reply.status(404).send({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
    }

    return mission;
  });

  // Delete mission
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.missions;
    const deleted = await repo.delete(id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
    }

    return reply.status(204).send();
  });

  // Pause mission
  fastify.post<{ Params: { id: string } }>('/:id/pause', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.missions;
    const mission = await repo.updateStatus(id, 'needs_takeover');

    if (!mission) {
      return reply.status(404).send({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
    }

    return mission;
  });

  // Resume mission
  fastify.post<{ Params: { id: string } }>('/:id/resume', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.missions;
    const mission = await repo.updateStatus(id, 'running');

    if (!mission) {
      return reply.status(404).send({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
    }

    return mission;
  });

  // Cancel mission
  fastify.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.missions;
    const mission = await repo.updateStatus(id, 'failed');

    if (!mission) {
      return reply.status(404).send({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
    }

    return mission;
  });

  // Capture screenshot (placeholder — delegates to uiExecutor in production)
  fastify.post<{ Params: { id: string } }>('/:id/screenshot', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.missions;
    const mission = await repo.findById(id);

    if (!mission) {
      return reply.status(404).send({ error: 'Mission not found', code: 'MISSION_NOT_FOUND' });
    }

    // TODO: Delegate to uiExecutor for actual screenshot capture
    return {
      mission_id: id,
      imageBase64: null,
      message: 'Screenshot capture not yet implemented via backend API',
    };
  });
}
