/**
 * Events Routes — Server-Sent Events (SSE) for real-time call updates
 *
 * Clients connect via GET /api/v1/events and receive push notifications
 * when call events occur, eliminating the need for polling.
 *
 * Query params:
 *   tenant  — Required. Subscribe to events for this tenant.
 *   types   — Optional. Comma-separated event types to filter (e.g. "call.status_changed,call.ended")
 *
 * @route GET /api/v1/events  - SSE stream
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CallEvent } from '../services/event-bus.js';
import { isGodAdminEmail } from '../../services/repositories/admin.repository.js';

export async function eventsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const query = z.object({
      tenant: z.string().min(1),
      types: z.string().optional(),
    }).parse(request.query);

    const jwtPayload = (request as any).user || {};
    const tenantId = query.tenant;
    const email = jwtPayload.email;

    // Security: user can only subscribe to their own tenant's events
    // God admins bypass tenant isolation
    const userTenantId = jwtPayload.app_metadata?.tenant_id;
    if (!isGodAdminEmail(email) && userTenantId && userTenantId !== tenantId) {
      return reply.status(403).send({
        error: 'Cannot subscribe to events for another tenant',
        code: 'FORBIDDEN',
      });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    const eventBus: any = (fastify as any).eventBus;
    const channel = `cham-ai:calls:${tenantId}`;
    const filterTypes = query.types ? query.types.split(',') : null;

    // Send initial comment to establish connection
    reply.raw.write(': connected\n\n');

    // Subscribe to local events
    const unsubscribe = eventBus.subscribe(channel, (event: CallEvent) => {
      if (filterTypes && !filterTypes.includes(event.type)) return;

      reply.raw.write(
        `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
      );
    });

    // Keep-alive ping every 30s
    const keepAlive = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, 30_000);

    // Clean up on disconnect
    request.raw.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });
}
