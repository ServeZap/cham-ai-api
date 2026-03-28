/**
 * Demo Routes
 *
 * Public endpoints for landing page (no auth required).
 *
 * @route POST /api/v1/demo/requests  - Submit a demo request
 */

import { FastifyInstance } from 'fastify';
import { DemoRequestSchema } from '../../../../contracts/src/index.js';

export async function demoRoutes(fastify: FastifyInstance) {
  fastify.post('/requests', async (request, reply) => {
    const data = DemoRequestSchema.parse(request.body);
    const repo = (fastify as any).repositories.demo;

    await repo.insertRequest({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      company: data.company || null,
      message: data.message || null,
    });

    return reply.status(201).send({ success: true });
  });
}
