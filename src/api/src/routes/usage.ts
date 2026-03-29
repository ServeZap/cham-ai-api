/**
 * Usage Routes — Cost Governance API
 *
 * Track and query AI/telephony usage per tenant.
 *
 * @route GET  /api/v1/usage/summary        - Daily/monthly usage summary
 * @route GET  /api/v1/usage/limits          - Get tenant limits
 * @route PUT  /api/v1/usage/limits          - Update tenant limits
 * @route POST /api/v1/usage/check           - Check if action is within limits
 * @route GET  /api/v1/usage/calls/:callId   - Per-call usage breakdown
 */

import { FastifyInstance } from 'fastify';
import { getTenantId } from '../hooks/auth.js';
import { isGodAdminEmail } from '../../services/repositories/admin.repository.js';
import {
  UsageQuerySchema,
  TenantLimitsSchema,
  CostCheckSchema,
} from '../../../../contracts/src/index.js';

export async function usageRoutes(fastify: FastifyInstance) {
  const db = (fastify as any).db;
  const hasDb = !!db;

  // GET /usage/summary — aggregated usage for current tenant
  fastify.get('/summary', async (request, reply) => {
    const query = UsageQuerySchema.parse(request.query);
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const godAdmin = isGodAdminEmail(jwtPayload.email);

    if (!tenantId && !godAdmin) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    if (!hasDb) {
      return reply.status(503).send({ error: 'Database not configured', code: 'DB_UNAVAILABLE' });
    }

    // Build date filter
    const since = query.since || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const until = query.until || new Date().toISOString().split('T')[0];

    let sql: string;
    let params: any[];

    if (query.granularity === 'hour') {
      sql = `
        SELECT
          DATE_TRUNC('hour', created_at) AS period,
          COUNT(*) AS total_events,
          SUM(llm_total_tokens) AS total_tokens,
          SUM(telephony_duration_seconds) AS total_seconds,
          SUM(total_cost) AS total_cost,
          SUM(CASE WHEN stt_provider IS NOT NULL THEN 1 ELSE 0 END) AS stt_calls,
          SUM(CASE WHEN llm_provider IS NOT NULL THEN 1 ELSE 0 END) AS llm_calls,
          SUM(CASE WHEN tts_provider IS NOT NULL THEN 1 ELSE 0 END) AS tts_calls
        FROM call_usage
        WHERE ($1::text IS NULL OR tenant_id = $1::uuid)
          AND created_at >= $2::timestamptz
          AND created_at < ($3::timestamptz + INTERVAL '1 day')
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY period DESC
        LIMIT 168
      `;
    } else if (query.granularity === 'month') {
      sql = `
        SELECT
          DATE_TRUNC('month', created_at) AS period,
          COUNT(*) AS total_events,
          SUM(llm_total_tokens) AS total_tokens,
          SUM(telephony_duration_seconds) AS total_seconds,
          SUM(total_cost) AS total_cost,
          SUM(CASE WHEN stt_provider IS NOT NULL THEN 1 ELSE 0 END) AS stt_calls,
          SUM(CASE WHEN llm_provider IS NOT NULL THEN 1 ELSE 0 END) AS llm_calls,
          SUM(CASE WHEN tts_provider IS NOT NULL THEN 1 ELSE 0 END) AS tts_calls
        FROM call_usage
        WHERE ($1::text IS NULL OR tenant_id = $1::uuid)
          AND created_at >= $2::timestamptz
          AND created_at < ($3::timestamptz + INTERVAL '1 day')
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY period DESC
        LIMIT 12
      `;
    } else {
      // day granularity (default)
      sql = `
        SELECT
          created_at::date AS period,
          COUNT(*) AS total_events,
          SUM(llm_total_tokens) AS total_tokens,
          SUM(telephony_duration_seconds) AS total_seconds,
          SUM(total_cost) AS total_cost,
          SUM(CASE WHEN stt_provider IS NOT NULL THEN 1 ELSE 0 END) AS stt_calls,
          SUM(CASE WHEN llm_provider IS NOT NULL THEN 1 ELSE 0 END) AS llm_calls,
          SUM(CASE WHEN tts_provider IS NOT NULL THEN 1 ELSE 0 END) AS tts_calls
        FROM call_usage
        WHERE ($1::text IS NULL OR tenant_id = $1::uuid)
          AND created_at >= $2::timestamptz
          AND created_at < ($3::timestamptz + INTERVAL '1 day')
        GROUP BY created_at::date
        ORDER BY period DESC
        LIMIT 90
      `;
    }

    params = [tenantId || null, since, until];

    try {
      const result = await db.query(sql, params);
      return {
        granularity: query.granularity,
        since,
        until,
        data: result.rows.map((row: any) => ({
          period: row.period,
          total_events: parseInt(row.total_events || '0', 10),
          total_tokens: parseInt(row.total_tokens || '0', 10),
          total_seconds: parseInt(row.total_seconds || '0', 10),
          total_minutes: Math.round((parseInt(row.total_seconds || '0', 10)) / 60 * 100) / 100,
          total_cost: parseFloat(row.total_cost || '0'),
          stt_calls: parseInt(row.stt_calls || '0', 10),
          llm_calls: parseInt(row.llm_calls || '0', 10),
          tts_calls: parseInt(row.tts_calls || '0', 10),
        })),
      };
    } catch (err: any) {
      fastify.log.error({ err }, '[Usage] Failed to query usage summary');
      return reply.status(500).send({ error: 'Failed to query usage', code: 'USAGE_ERROR' });
    }
  });

  // GET /usage/limits — current tenant limits
  fastify.get('/limits', async (request, reply) => {
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);

    if (!tenantId) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    if (!hasDb) {
      return reply.status(503).send({ error: 'Database not configured', code: 'DB_UNAVAILABLE' });
    }

    // Get limits
    const limitsResult = await db.query(
      'SELECT * FROM tenant_limits WHERE tenant_id = $1',
      [tenantId]
    );

    // Get today's usage
    const usageResult = await db.query(
      `SELECT
        COALESCE(SUM(telephony_duration_seconds), 0) / 60 AS current_minutes,
        COALESCE(SUM(llm_total_tokens), 0) AS current_tokens,
        COALESCE(SUM(total_cost), 0) AS current_cost
      FROM call_usage
      WHERE tenant_id = $1 AND created_at::date = CURRENT_DATE`,
      [tenantId]
    );

    const limits = limitsResult.rows[0] || {
      max_minutes_per_day: 60,
      max_tokens_per_day: 100000,
      max_cost_per_day: 10.00,
      max_concurrent_calls: 5,
      currency: 'USD',
    };

    const usage = usageResult.rows[0] || {
      current_minutes: 0,
      current_tokens: 0,
      current_cost: 0,
    };

    return {
      ...limits,
      current_minutes: parseInt(usage.current_minutes || '0', 10),
      max_minutes: limits.max_minutes_per_day,
      current_tokens: parseInt(usage.current_tokens || '0', 10),
      max_tokens: limits.max_tokens_per_day,
      current_cost: parseFloat(usage.current_cost || '0'),
      max_cost: parseFloat(limits.max_cost_per_day),
      utilization_percent: {
        minutes: limits.max_minutes_per_day > 0
          ? Math.round((parseInt(usage.current_minutes || '0', 10) / limits.max_minutes_per_day) * 100)
          : 0,
        tokens: limits.max_tokens_per_day > 0
          ? Math.round((parseInt(usage.current_tokens || '0', 10) / limits.max_tokens_per_day) * 100)
          : 0,
        cost: limits.max_cost_per_day > 0
          ? Math.round((parseFloat(usage.current_cost || '0') / limits.max_cost_per_day) * 100)
          : 0,
      },
    };
  });

  // PUT /usage/limits — update tenant limits (god admin or tenant admin)
  fastify.put('/limits', async (request, reply) => {
    const data = TenantLimitsSchema.parse(request.body);
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);
    const godAdmin = isGodAdminEmail(jwtPayload.email);

    if (!tenantId && !godAdmin) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    if (!hasDb) {
      return reply.status(503).send({ error: 'Database not configured', code: 'DB_UNAVAILABLE' });
    }

    // Upsert limits
    const result = await db.query(
      `INSERT INTO tenant_limits (tenant_id, max_minutes_per_day, max_tokens_per_day, max_cost_per_day, max_concurrent_calls, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id) DO UPDATE SET
         max_minutes_per_day = COALESCE($2, tenant_limits.max_minutes_per_day),
         max_tokens_per_day = COALESCE($3, tenant_limits.max_tokens_per_day),
         max_cost_per_day = COALESCE($4, tenant_limits.max_cost_per_day),
         max_concurrent_calls = COALESCE($5, tenant_limits.max_concurrent_calls),
         currency = COALESCE($6, tenant_limits.currency)
       RETURNING *`,
      [
        tenantId,
        data.max_minutes_per_day ?? null,
        data.max_tokens_per_day ?? null,
        data.max_cost_per_day ?? null,
        data.max_concurrent_calls ?? null,
        data.currency ?? null,
      ]
    );

    return result.rows[0];
  });

  // POST /usage/check — pre-flight cost limit check
  fastify.post('/check', async (request, reply) => {
    const data = CostCheckSchema.parse(request.body);
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);

    if (!tenantId) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    if (!hasDb) {
      // Without DB, always allow (dev mode)
      return { allowed: true, reason: null, mode: 'dev_no_db' };
    }

    try {
      const result = await db.query(
        'SELECT * FROM check_tenant_limits($1, $2, $3, $4)',
        [tenantId, data.estimated_minutes, data.estimated_tokens, data.estimated_cost]
      );

      const check = result.rows[0];
      return {
        allowed: check.allowed,
        reason: check.reason,
        current_minutes: parseInt(check.current_minutes || '0', 10),
        max_minutes: check.max_minutes,
        current_tokens: parseInt(check.current_tokens || '0', 10),
        max_tokens: check.max_tokens,
        current_cost: parseFloat(check.current_cost || '0'),
        max_cost: parseFloat(check.max_cost || '0'),
      };
    } catch (err: any) {
      fastify.log.error({ err }, '[Usage] Failed to check tenant limits');
      // Fail open — don't block calls on cost check errors
      return { allowed: true, reason: null, mode: 'error_fail_open' };
    }
  });

  // GET /usage/calls/:callId — per-call cost breakdown
  fastify.get<{ Params: { callId: string } }>('/calls/:callId', async (request, reply) => {
    const { callId } = request.params;
    const jwtPayload = (request as any).user || {};
    const tenantId = getTenantId(jwtPayload);

    if (!tenantId) {
      return reply.status(403).send({ error: 'Tenant ID not found in token', code: 'TENANT_NOT_FOUND' });
    }

    if (!hasDb) {
      return reply.status(503).send({ error: 'Database not configured', code: 'DB_UNAVAILABLE' });
    }

    const result = await db.query(
      'SELECT * FROM call_usage WHERE call_id = $1 AND tenant_id = $2',
      [callId, tenantId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Usage not found for this call', code: 'USAGE_NOT_FOUND' });
    }

    return result.rows[0];
  });
}
