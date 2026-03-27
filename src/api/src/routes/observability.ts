/**
 * Observability Routes
 *
 * Metrics, uptime history, and alerts.
 *
 * @route GET /api/v1/observability/metrics  - Provider metrics (latency, uptime, error rates)
 * @route GET /api/v1/observability/uptime   - Monthly uptime history
 * @route GET /api/v1/observability/alerts   - Active provider alerts
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const MetricsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

export async function observabilityRoutes(fastify: FastifyInstance) {
  // Provider metrics
  fastify.get('/metrics', async (request, reply) => {
    const { period } = MetricsQuerySchema.parse(request.query);

    const since = getPeriodStart(period);
    const repo = (fastify as any).repositories.healthChecks;
    const checks = await repo.findRecent(since.toISOString(), 1000);

    // Group by provider
    const grouped = new Map<string, any[]>();
    for (const check of checks) {
      const key = check.provider_name;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(check);
    }

    const providerMetrics = Array.from(grouped.entries()).map(([provider, rows]) => {
      const latencies = rows
        .filter((r: any) => r.latency_ms !== null && r.latency_ms > 0)
        .map((r: any) => r.latency_ms)
        .sort((a: number, b: number) => a - b);

      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((s: number, l: number) => s + l, 0) / latencies.length)
        : 0;
      const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
      const minLatency = latencies.length > 0 ? latencies[0] : 0;
      const p95 = percentile(latencies, 95);

      const totalChecks = rows.length;
      const healthyChecks = rows.filter((r: any) => r.status === 'healthy').length;
      const errorChecks = rows.filter((r: any) => r.status === 'down' || r.status === 'degraded').length;
      const errorRate = totalChecks > 0 ? +((errorChecks / totalChecks) * 100).toFixed(2) : 0;
      const uptime = totalChecks > 0 ? +((healthyChecks / totalChecks) * 100).toFixed(2) : 100;

      // Error type classification
      const errorMap = new Map<string, number>();
      rows
        .filter((r) => r.status === 'down' || r.status === 'degraded')
        .forEach((r) => {
          const type = classifyError(r.error);
          errorMap.set(type, (errorMap.get(type) || 0) + 1);
        });
      const errorTypes = Array.from(errorMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Trend
      const mid = Math.floor(rows.length / 2);
      const firstHalf = rows.slice(0, mid);
      const secondHalf = rows.slice(mid);
      const firstUptime = firstHalf.length > 0
        ? firstHalf.filter((r) => r.status === 'healthy').length / firstHalf.length
        : 1;
      const secondUptime = secondHalf.length > 0
        ? secondHalf.filter((r) => r.status === 'healthy').length / secondHalf.length
        : 1;
      const trend: 'up' | 'down' | 'stable' =
        secondUptime > firstUptime + 0.02 ? 'up' : secondUptime < firstUptime - 0.02 ? 'down' : 'stable';

      return {
        provider,
        label: rows[0]?.provider_label || provider,
        avgLatency,
        maxLatency,
        minLatency,
        p95Latency: p95,
        totalChecks,
        healthyChecks,
        errorChecks,
        errorRate,
        uptime,
        errorTypes,
        trend,
      };
    });

    // Summary
    const metrics = providerMetrics.filter((m) => m.totalChecks > 0);
    const summary = {
      avgLatency: metrics.length > 0
        ? Math.round(metrics.reduce((s, m) => s + m.avgLatency, 0) / metrics.length)
        : 0,
      avgUptime: metrics.length > 0
        ? +(metrics.reduce((s, m) => s + m.uptime, 0) / metrics.length).toFixed(2)
        : 100,
      totalErrors: metrics.reduce((s, m) => s + m.errorChecks, 0),
      totalChecks: metrics.reduce((s, m) => s + m.totalChecks, 0),
      overallErrorRate: (() => {
        const te = metrics.reduce((s, m) => s + m.errorChecks, 0);
        const tc = metrics.reduce((s, m) => s + m.totalChecks, 0);
        return tc > 0 ? +((te / tc) * 100).toFixed(2) : 0;
      })(),
    };

    return { providerMetrics, summary, checks };
  });

  // Uptime history
  fastify.get('/uptime', async (request, reply) => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const repo = (fastify as any).repositories.healthChecks;
    const checks = await repo.findUptimeHistory(twelveMonthsAgo.toISOString());

    // Build monthly uptime
    const now = new Date();
    const providers = ['stt', 'agent', 'telephony', 'uiExecutor'];
    const monthlyUptime = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const monthIdx = d.getMonth();
      const monthsPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthsFullPt = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

      const monthChecks = checks.filter((c: any) => {
        const ct = new Date(c.check_timestamp);
        return ct >= d && ct < nextMonth;
      });

      const entry: any = {
        month: monthsPt[monthIdx],
        monthFull: `${monthsFullPt[monthIdx]} ${d.getFullYear()}`,
      };

      for (const pKey of providers) {
        const pChecks = monthChecks.filter((c: any) => c.provider_name === pKey);
        if (pChecks.length > 0) {
          const healthy = pChecks.filter((c: any) => c.status === 'healthy').length;
          entry[pKey] = +((healthy / pChecks.length) * 100).toFixed(2);
        } else {
          entry[pKey] = 100; // Default to 100% if no data
        }
      }

      monthlyUptime.push(entry);
    }

    return { monthlyUptime };
  });

  // Active alerts
  fastify.get('/alerts', async (request, reply) => {
    const repo = (fastify as any).repositories.healthChecks;
    const alerts = await repo.findAlerts();
    return { alerts };
  });

  // Alert history (all alerts, not just active)
  fastify.get('/alert-history', async (request) => {
    const query = z.object({
      limit: z.coerce.number().min(1).max(500).default(200),
    }).parse(request.query);
    const db = (fastify as any).pg;

    const result = await db.query(
      `SELECT * FROM provider_alerts ORDER BY created_at DESC LIMIT $1`,
      [query.limit]
    );
    return { data: result.rows };
  });

  // Provider jobs (paginated)
  fastify.get('/provider-jobs', async (request) => {
    const query = z.object({
      page: z.coerce.number().min(0).default(0),
      pageSize: z.coerce.number().min(1).max(100).default(25),
      provider_type: z.string().optional(),
      status: z.string().optional(),
    }).parse(request.query);
    const db = (fastify as any).pg;

    let sql = `SELECT * FROM provider_jobs`;
    const params: any[] = [];
    let paramIdx = 1;

    const conditions: string[] = [];
    if (query.provider_type && query.provider_type !== 'all') {
      conditions.push(`provider_type = $${paramIdx++}`);
      params.push(query.provider_type);
    }
    if (query.status && query.status !== 'all') {
      conditions.push(`status = $${paramIdx++}`);
      params.push(query.status);
    }
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;

    sql += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(query.pageSize, query.page * query.pageSize);

    const result = await db.query(sql, params);
    return { data: result.rows };
  });

  // Health checks raw (for GPU status / detailed views)
  fastify.get('/health-checks', async (request) => {
    const query = z.object({
      limit: z.coerce.number().min(1).max(2000).default(500),
    }).parse(request.query);
    const db = (fastify as any).pg;

    const result = await db.query(
      `SELECT * FROM historico_health_checks ORDER BY check_timestamp DESC LIMIT $1`,
      [query.limit]
    );
    return { data: result.rows };
  });

  // Failover logs raw (for GPU status / detailed views)
  fastify.get('/failover-logs', async (request) => {
    const query = z.object({
      limit: z.coerce.number().min(1).max(500).default(200),
    }).parse(request.query);
    const db = (fastify as any).pg;

    const result = await db.query(
      `SELECT * FROM failover_notification_log ORDER BY triggered_at DESC LIMIT $1`,
      [query.limit]
    );
    return { data: result.rows };
  });
}

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'daily':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

function classifyError(error: string | null): string {
  if (!error) return 'unknown';
  const e = error.toLowerCase();
  if (e.includes('gpu') || e.includes('cuda') || e.includes('oom')) return 'GPU Failure';
  if (e.includes('timeout') || e.includes('aborted')) return 'Timeout';
  if (e.includes('url not configured')) return 'Not Configured';
  if (e.includes('503') || e.includes('502') || e.includes('500')) return 'Server Error (5xx)';
  if (e.includes('401') || e.includes('403')) return 'Auth Error';
  if (e.includes('network') || e.includes('fetch') || e.includes('dns')) return 'Network Error';
  if (e.includes('connection')) return 'Connection Error';
  return 'Other';
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
