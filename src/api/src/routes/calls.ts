/**
 * Calls Routes
 *
 * Inbound and outbound call management
 *
 * @route POST   /api/v1/calls/inbound     - Handle inbound call
 * @route POST   /api/v1/calls/outbound    - Initiate outbound call
 * @route GET    /api/v1/calls/:id         - Get call details
 * @route GET    /api/v1/calls/:id/recording - Get call recording
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const OutboundCallSchema = z.object({
  phone_number: z.string().min(10),
  assistant_id: z.string().uuid(),
  metadata: z.record(z.any()).optional(),
});

export async function callsRoutes(fastify: FastifyInstance) {
  // Handle inbound call (webhook from Twilio/Vonage)
  fastify.post('/inbound', async (request, reply) => {
    const { CallSid, From, To } = request.body as any;

    // TODO: Implement inbound call handling
    // 1. Create session
    // 2. Connect to Voice Service
    // 3. Stream audio back and forth

    return {
      call_id: CallSid,
      status: 'answered',
      session_id: crypto.randomUUID(),
    };
  });

  // Initiate outbound call
  fastify.post('/outbound', async (request, reply) => {
    const data = OutboundCallSchema.parse(request.body);

    // TODO: Implement outbound call via Twilio/Vonage
    const call = {
      id: crypto.randomUUID(),
      phone_number: data.phone_number,
      assistant_id: data.assistant_id,
      status: 'initiated',
      created_at: new Date().toISOString(),
    };

    return reply.status(201).send(call);
  });

  // Get call details
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    return reply.status(404).send({
      error: 'Call not found',
      code: 'CALL_NOT_FOUND',
    });
  });

  // Get call recording
  fastify.get('/:id/recording', async (request, reply) => {
    const { id } = request.params as { id: string };

    return reply.status(404).send({
      error: 'Recording not found',
      code: 'RECORDING_NOT_FOUND',
    });
  });
}
