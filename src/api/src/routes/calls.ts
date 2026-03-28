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
import { z } from 'zod';
import { getTenantId } from '../hooks/auth.js';
import { isGodAdminEmail } from '../../services/repositories/admin.repository.js';

const OutboundCallSchema = z.object({
  phone_number: z.string().min(10),
  assistant_id: z.string().uuid(),
  metadata: z.record(z.any()).optional(),
});

const InboundCallSchema = z.object({
  CallSid: z.string().optional(),
  From: z.string().optional(),
  To: z.string().optional(),
});

const ListCallsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

const OverviewSchema = z.object({
  since: z.string().min(1),
  until: z.string().optional(),
});

const TranscriptSchema = z.object({
  call_id: z.string().min(1),
  transcript_text: z.string().min(1),
  language: z.string().optional(),
  segments: z.any().optional(),
  confidence: z.number().nullable().optional(),
});

export async function callsRoutes(fastify: FastifyInstance) {
  // Handle inbound call (webhook from Twilio/Vonage)
  fastify.post('/inbound', async (request, reply) => {
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
    const repo = (fastify as any).repositories.calls;
    const call = await repo.findById(id);

    if (!call) {
      return reply.status(404).send({ error: 'Call not found', code: 'CALL_NOT_FOUND' });
    }

    return call;
  });

  // Get call recording
  fastify.get<{ Params: { id: string } }>('/:id/recording', async (request, reply) => {
    const { id } = request.params;
    const repo = (fastify as any).repositories.calls;
    const call = await repo.findById(id);

    if (!call) {
      return reply.status(404).send({ error: 'Call not found', code: 'CALL_NOT_FOUND' });
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
    const db = (fastify as any).pg;

    const result = await db.query(
      `INSERT INTO transcripts (call_id, transcript_text, language, segments, confidence, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, call_id, created_at`,
      [data.call_id, data.transcript_text, data.language || null, data.segments ? JSON.stringify(data.segments) : null, data.confidence ?? null, tenantId]
    );

    const row = result.rows[0];
    return reply.status(201).send(row);
  });

  // Get transcript for a call
  fastify.get('/transcripts/:callId', async (request, reply) => {
    const { callId } = request.params as { callId: string };
    const db = (fastify as any).pg;

    const result = await db.query(
      `SELECT transcript_text, language, segments, created_at, confidence
       FROM transcripts
       WHERE call_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [callId]
    );

    const row = result.rows[0] || null;
    return { data: row };
  });

  // Get transcribe job audio_ref for a call
  fastify.get('/transcribe-jobs/:callId/audio', async (request, reply) => {
    const { callId } = request.params as { callId: string };
    const db = (fastify as any).pg;

    const result = await db.query(
      `SELECT audio_ref
       FROM transcribe_jobs
       WHERE call_id = $1 AND audio_ref IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [callId]
    );

    const row = result.rows[0] || null;
    return { data: row };
  });

  // CDR records for billing (telecom_usage with joined call data)
  fastify.get('/cdrs', async (request, reply) => {
    const query = z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      offset: z.coerce.number().min(0).default(0),
      limit: z.coerce.number().min(1).max(1000).default(1000),
    }).parse(request.query);
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const db = (fastify as any).pg;

    // Enforce tenant isolation — god admins can see all tenants
    if (!tenantId && !isGodAdminEmail(jwtPayload.email)) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    let sql = `SELECT tu.*, c.caller_number, c.duration_seconds, c.status, c.outcome
               FROM telecom_usage tu
               LEFT JOIN calls c ON c.id = tu.call_id`;
    const params: any[] = [];
    let paramIdx = 1;
    let hasWhere = false;

    // Tenant isolation filter (god admins see all)
    if (tenantId) {
      sql += ` WHERE tu.tenant_id = $${paramIdx++}`;
      params.push(tenantId);
      hasWhere = true;
    }

    if (query.dateFrom) {
      sql += hasWhere ? ` AND tu.timestamp >= $${paramIdx++}` : ` WHERE tu.timestamp >= $${paramIdx++}`;
      params.push(query.dateFrom);
      hasWhere = true;
    }
    if (query.dateTo) {
      sql += hasWhere ? ` AND tu.timestamp <= $${paramIdx++}` : ` WHERE tu.timestamp <= $${paramIdx++}`;
      params.push(query.dateTo);
    }

    sql += ` ORDER BY tu.timestamp DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(query.limit, query.offset);

    const result = await db.query(sql, params);
    return { data: result.rows };
  });
}
