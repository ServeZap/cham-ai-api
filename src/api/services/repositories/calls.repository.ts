/**
 * Calls Repository
 *
 * Database operations for calls, campaigns, and tool_executions tables.
 */

import { BaseRepository } from './base.js';

export interface CallRow {
  id: string;
  user_id: string;
  tenant_id: string;
  caller_number: string | null;
  receiver_id: string | null;
  campaign_id: string | null;
  status: string;
  outcome: string | null;
  duration_seconds: number | null;
  cost: number | null;
  tool_used: string | null;
  stt_latency_ms: number | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallOverview {
  totalCalls: number;
  avgDuration: number;
  conversionRate: number;
  avgCost: number;
  p95Latency: number;
  dailyVolume: { day: string; chamadas: number }[];
  campaignConversion: { campanha: string; conversao: number }[];
  dailyCost: { day: string; diario: number; acumulado: number }[];
  outcomes: { name: string; value: number; color: string }[];
  toolUsage: { tool: string; count: number }[];
  recentCalls: {
    id: string;
    from: string;
    status: string;
    duration: string;
    tool: string;
    outcome: string;
  }[];
}

export interface CallFilter {
  tenant_id?: string;
  status?: string;
  campaign_id?: string;
  since?: string;
  until?: string;
  page?: number;
  limit?: number;
}

export class CallsRepository extends BaseRepository {
  async findAll(filter: CallFilter): Promise<{ calls: CallRow[]; total: number }> {
    const {
      tenant_id,
      status,
      campaign_id,
      since,
      until,
      page = 1,
      limit = 50,
    } = filter;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (tenant_id) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(tenant_id);
    }
    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (campaign_id) {
      conditions.push(`campaign_id = $${paramIndex++}`);
      params.push(campaign_id);
    }
    if (since) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(since);
    }
    if (until) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(until);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM calls ${whereClause}`;
    const countResult = await this.queryOne<{ total: string }>(countSql, params);
    const total = parseInt(countResult?.total || '0', 10);

    const sql = `
      SELECT * FROM calls ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const calls = await this.query<CallRow>(sql, params);
    return { calls, total };
  }

  async findById(id: string): Promise<CallRow | null> {
    return this.queryOne<CallRow>('SELECT * FROM calls WHERE id = $1', [id]);
  }

  async create(data: Partial<CallRow>): Promise<CallRow> {
    return this.insert<CallRow>('calls', data);
  }

  async update(id: string, data: Partial<CallRow>): Promise<CallRow | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const sql = `
      UPDATE calls
      SET ${placeholders}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    return this.queryOne<CallRow>(sql, [...values, id]);
  }

  async getOverview(since: string, until?: string): Promise<CallOverview> {
    const params: any[] = [since];
    let paramIndex = 2;

    let dateFilter = `created_at >= $1`;
    if (until) {
      dateFilter += ` AND created_at <= $${paramIndex++}`;
      params.push(until);
    }

    // KPIs
    const kpiSql = `
      SELECT
        COUNT(*) as total_calls,
        COALESCE(AVG(duration_seconds), 0) as avg_duration,
        COALESCE(AVG(cost), 0) as avg_cost,
        COUNT(*) FILTER (WHERE outcome = 'resolved') as resolved_count
      FROM calls
      WHERE ${dateFilter}
    `;
    const kpis = await this.queryOne<any>(kpiSql, params);

    // P95 latency
    const p95Sql = `
      SELECT COALESCE(
        percentile_cont(0.95) WITHIN GROUP (ORDER BY stt_latency_ms), 0
      ) as p95_latency
      FROM calls
      WHERE ${dateFilter} AND stt_latency_ms IS NOT NULL AND stt_latency_ms > 0
    `;
    const p95Result = await this.queryOne<{ p95_latency: number }>(p95Sql, params);

    // Daily volume
    const dailySql = `
      SELECT TO_CHAR(created_at, 'DD') as day, COUNT(*) as chamadas
      FROM calls
      WHERE ${dateFilter}
      GROUP BY TO_CHAR(created_at, 'DD')
      ORDER BY day
    `;
    const dailyVolume = await this.query<{ day: string; chamadas: number }>(dailySql, params);

    // Campaign conversion
    const campSql = `
      SELECT COALESCE(c.name, ca.campaign_id) as campanha,
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE ca.outcome = 'resolved') as resolved
      FROM calls ca
      LEFT JOIN campaigns c ON c.id = ca.campaign_id
      WHERE ${dateFilter} AND ca.campaign_id IS NOT NULL
      GROUP BY c.name, ca.campaign_id
    `;
    const campRows = await this.query<any>(campSql, params);
    const campaignConversion = campRows.map((r) => ({
      campanha: r.campanha,
      conversao: r.total > 0 ? Math.round((r.resolved / r.total) * 100) : 0,
    }));

    // Daily cost
    const costSql = `
      SELECT TO_CHAR(created_at, 'DD') as day,
             SUM(cost) as diario
      FROM calls
      WHERE ${dateFilter}
      GROUP BY TO_CHAR(created_at, 'DD')
      ORDER BY day
    `;
    const costRows = await this.query<{ day: string; diario: number }>(costSql, params);
    let acc = 0;
    const dailyCost = costRows.map((r) => {
      acc += Number(r.diario) || 0;
      return {
        day: r.day,
        diario: Math.round((Number(r.diario) || 0) * 100) / 100,
        acumulado: Math.round(acc * 100) / 100,
      };
    });

    // Outcomes
    const outcomeColors: Record<string, string> = {
      resolved: 'hsl(160, 100%, 50%)',
      handoff: 'hsl(200, 80%, 55%)',
      failed: 'hsl(0, 72%, 51%)',
      in_progress: 'hsl(45, 80%, 50%)',
    };
    const outcomeLabels: Record<string, string> = {
      resolved: 'Resolvida',
      handoff: 'Handoff',
      failed: 'Falha',
      in_progress: 'Em andamento',
    };

    const outcomeSql = `
      SELECT outcome, COUNT(*) as count
      FROM calls
      WHERE ${dateFilter}
      GROUP BY outcome
    `;
    const outcomeRows = await this.query<{ outcome: string; count: number }>(outcomeSql, params);
    const totalCalls = kpis?.total_calls || 0;
    const outcomes = outcomeRows.map((r) => ({
      name: outcomeLabels[r.outcome || 'in_progress'] || r.outcome,
      value: totalCalls > 0 ? Math.round((r.count / totalCalls) * 100) : 0,
      color: outcomeColors[r.outcome || 'in_progress'] || 'hsl(215, 12%, 50%)',
    }));

    // Tool usage
    const toolSql = `
      SELECT tool_name, COUNT(*) as count
      FROM tool_executions
      WHERE ${dateFilter}
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 8
    `;
    const toolUsage = await this.query<{ tool: string; count: number }>(toolSql, params);

    // Recent calls
    const recentSql = `
      SELECT id, caller_number, status, outcome, duration_seconds, tool_used
      FROM calls
      WHERE ${dateFilter}
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const recentRows = await this.query<any>(recentSql, params);

    const formatDuration = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    const recentCalls = recentRows.map((r) => ({
      id: `#${r.id.slice(0, 4)}`,
      from: r.caller_number || '—',
      status: outcomeLabels[r.outcome || 'in_progress'] || r.outcome || '—',
      duration: formatDuration(r.duration_seconds || 0),
      tool: r.tool_used || '—',
      outcome: r.outcome || '—',
    }));

    return {
      totalCalls,
      avgDuration: Math.round(kpis?.avg_duration || 0),
      conversionRate: totalCalls > 0
        ? +(((kpis?.resolved_count || 0) / totalCalls) * 100).toFixed(1)
        : 0,
      avgCost: +(kpis?.avg_cost || 0).toFixed(2),
      p95Latency: Math.round(p95Result?.p95_latency || 0),
      dailyVolume,
      campaignConversion,
      dailyCost,
      outcomes,
      toolUsage,
      recentCalls,
    };
  }
}
