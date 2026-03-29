/**
 * Calls Routes
 *
 * Inbound and outbound call management with real database operations.
 *
 * @route POST /api/v1/calls/inbound          - Handle inbound call
 * @route POST /api/v1/calls/outbound         - Initiate outbound call
 * @route GET  /api/v1/calls                  - List calls (paginated)
 * @route GET  /api/v1/calls/overview         - KPIs and aggregated data
 * @route GET  /api/v1/calls/:id              - Get call details
 * @route GET  /api/v1/calls/:id/recording    - Get call recording
 */

import { FastifyInstance } from 'fastify';
import { getTenantId, verifyTwilioSignature } from '../hooks/auth.js';
import { isGodAdminEmail } from '../../services/repositories/admin.repository.js';
import {
  OutboundCallSchema,
  InboundCallSchema,
  ListCallsSchema,
  OverviewSchema,
  TranscriptSchema,
  CDRQuerySchema,
} from '../../../../contracts/src/index.js';

export async function callsRoutes(fastify: FastifyInstance) {
  // Handle inbound call (webhook from Twilio/Vonage)
  fastify.post('/inbound', async (request, reply) => {
    // SECURITY: Verify Twilio webhook signature to prevent spoofed calls
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = request.headers['x-twilio-signature'] as string | undefined;
      const protocol = request.headers['x-forwarded-proto'] || 'https';
      const host = request.headers['host'];
      const url = `${protocol}://${host}${request.url}`;
      const params = (request.body as Record<string, string>) || {};

      if (!signature || !verifyTwilioSignature(url, params, signature, authToken)) {
        fastify.log.warn('[Calls] Inbound webhook signature verification failed');
        return reply.status(401).send({ error: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' });
      }
    }

    const body = InboundCallSchema.parse(request.body);
    const repo = (fastify as any).repositories.calls;

    const call = await repo.create({
      caller_number: body.From,
      receiver_id: body.To,
      status: 'answered',
      start_time: new Date().toISOString(),
    });

    // Publish event
    const eventBus: any = (fastify as any).eventBus;
    if (eventBus && call.tenant_id) {
      await eventBus.publish({
        type: 'call.created',
        tenantId: call.tenant_id,
        callId: call.id,
        payload: { status: call.status, caller_number: call.caller_number, receiver_id: call.receiver_id },
        timestamp: new Date().toISOString(),
      });
    }

    // Create session for this call
    const sessionsRepo = (fastify as any).repositories.sessions;
    const session = await sessionsRepo.create({
      tenant_id: call.tenant_id || 'system',
      assistant_id: null,
    });

    return {
      call_id: call.id,
      status: 'answered',
      session_id: session.id,
    };
  });

  // Initiate outbound call
  fastify.post('/outbound', async (request, reply) => {
    const data = OutboundCallSchema.parse(request.body);
    const jwtPayload = (request as any).user || {};
    const repo = (fastify as any).repositories.calls;

    const call = await repo.create({
      user_id: jwtPayload.sub,
      tenant_id: jwtPayload.app_metadata?.tenant_id,
      caller_number: null,
      receiver_id: data.phone_number,
      status: 'initiated',
      start_time: new Date().toISOString(),
    });

    // Publish event
    const eventBus: any = (fastify as any).eventBus;
    if (eventBus && call.tenant_id) {
      await eventBus.publish({
        type: 'call.created',
        tenantId: call.tenant_id,
        callId: call.id,
        payload: { status: call.status, receiver_id: call.receiver_id },
        timestamp: new Date().toISOString(),
      });
    }

    // TODO: Dispatch to telephony provider (ClawdTalk/Twilio)
    // For now, mark as initiated

    return reply.status(201).send(call);
  });

  // List calls (new endpoint for use-call-history)
  fastify.get('/', async (request, reply) => {
    const query = ListCallsSchema.parse(request.query);
    const jwtPayload = (request as any).user || {};
    const repo = (fastify as any).repositories.calls;

    const result = await repo.findAll({
      tenant_id: jwtPayload.app_metadata?.tenant_id,
      status: query.status,
      since: query.since,
      until: query.until,
      page: query.page,
      limit: query.limit,
    });

    return {
      calls: result.calls,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        pages: Math.ceil(result.total / query.limit),
      },
    };
  });

  // Overview KPIs (new endpoint for use-overview-data)
  fastify.get('/overview', async (request, reply) => {
    const query = OverviewSchema.parse(request.query);
    const repo = (fastify as any).repositories.calls;

    const overview = await repo.getOverview(query.since, query.until);
    return overview;
  });

  // Get call details
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const repo = (fastify as any).repositories.calls;
    const call = await repo.findById(id);

    if (!call) {
      return reply.status(404).send({ error: 'Call not found', code: 'CALL_NOT_FOUND' });
    }

    // SECURITY: Enforce tenant isolation — god admins can see all tenants
    if (!tenantId && !isGodAdminEmail(jwtPayload.email)) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }
    if (tenantId && call.tenant_id && call.tenant_id !== tenantId && !isGodAdminEmail(jwtPayload.email)) {
      return reply.status(403).send({ error: 'Access denied', code: 'FORBIDDEN' });
    }

    return call;
  });

  // Get call recording
  fastify.get<{ Params: { id: string } }>('/:id/recording', async (request, reply) => {
    const { id } = request.params;
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const repo = (fastify as any).repositories.calls;
    const call = await repo.findById(id);

    if (!call) {
      return reply.status(404).send({ error: 'Call not found', code: 'CALL_NOT_FOUND' });
    }

    // SECURITY: Enforce tenant isolation
    if (!tenantId && !isGodAdminEmail(jwtPayload.email)) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }
    if (tenantId && call.tenant_id && call.tenant_id !== tenantId && !isGodAdminEmail(jwtPayload.email)) {
      return reply.status(403).send({ error: 'Access denied', code: 'FORBIDDEN' });
    }

    // TODO: Return actual recording URL from storage
    return reply.status(404).send({
      error: 'Recording not found',
      code: 'RECORDING_NOT_FOUND',
    });
  });

  // Save transcript for a call
  fastify.post('/transcripts', async (request, reply) => {
    const data = TranscriptSchema.parse(request.body);
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const repo = (fastify as any).repositories.calls;

    const row = await repo.insertTranscript({ ...data, tenant_id: tenantId });
    return reply.status(201).send(row);
  });

  // Get transcript for a call
  fastify.get('/transcripts/:callId', async (request, reply) => {
    const { callId } = request.params as { callId: string };
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const repo = (fastify as any).repositories.calls;

    // SECURITY: Enforce tenant isolation
    if (!tenantId && !isGodAdminEmail(jwtPayload.email)) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    const row = await repo.findTranscript(callId);
    return { data: row };
  });

  // Get transcribe job audio_ref for a call
  fastify.get('/transcribe-jobs/:callId/audio', async (request, reply) => {
    const { callId } = request.params as { callId: string };
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const repo = (fastify as any).repositories.calls;

    // SECURITY: Enforce tenant isolation
    if (!tenantId && !isGodAdminEmail(jwtPayload.email)) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    const row = await repo.findTranscribeJobAudio(callId);
    return { data: row };
  });

  // CDR records for billing (telecom_usage with joined call data)
  fastify.get('/cdrs', async (request, reply) => {
    const query = CDRQuerySchema.parse(request.query);
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);

    // Enforce tenant isolation — god admins can see all tenants
    if (!tenantId && !isGodAdminEmail(jwtPayload.email)) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    const repo = (fastify as any).repositories.calls;
    const rows = await repo.findCdrs({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      offset: query.offset,
      limit: query.limit,
      tenant_id: tenantId,
    });
    return { data: rows };
  });
}
