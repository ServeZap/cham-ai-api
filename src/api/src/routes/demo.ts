/**
 * Demo Routes
 *
 * Public endpoints for landing page (no auth required).
 *
 * @route POST /api/v1/demo/requests  - Submit a demo request
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const DemoRequestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(20).nullable().optional(),
  company: z.string().max(100).nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
});

export async function demoRoutes(fastify: FastifyInstance) {
  fastify.post('/requests', async (request, reply) => {
    const data = DemoRequestSchema.parse(request.body);
    const db = (fastify as any).pg;

    await db.query(
      `INSERT INTO demo_requests (name, email, phone, company, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.name, data.email, data.phone || null, data.company || null, data.message || null]
    );

    return reply.status(201).send({ success: true });
  });
}
