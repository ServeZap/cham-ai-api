/**
 * Telecom Usage Repository
 *
 * Database operations for telecom_usage table.
 */

import { BaseRepository } from './base.js';

export interface TelecomUsageRow {
  id: string;
  tenant_id: string;
  period: string;
  total_minutes: number;
  total_cost: number;
  call_count: number;
  sms_count: number;
  created_at: string;
}

export class TelecomUsageRepository extends BaseRepository {
  async findByTenant(
    tenantId: string,
    period?: string
  ): Promise<TelecomUsageRow[]> {
    if (period) {
      return this.query<TelecomUsageRow>(
        `SELECT * FROM telecom_usage
         WHERE tenant_id = $1 AND period = $2
         ORDER BY period DESC`,
        [tenantId, period]
      );
    }

    return this.query<TelecomUsageRow>(
      `SELECT * FROM telecom_usage
       WHERE tenant_id = $1
       ORDER BY period DESC
       LIMIT 12`,
      [tenantId]
    );
  }

  async getUsageSummary(
    tenantId: string,
    since: string,
    until?: string
  ): Promise<{
    totalMinutes: number;
    totalCost: number;
    callCount: number;
    smsCount: number;
  }> {
    const params: any[] = [tenantId, since];
    let paramIndex = 3;
    let dateFilter = `created_at >= $2`;
    if (until) {
      dateFilter += ` AND created_at <= $${paramIndex++}`;
      params.push(until);
    }

    const sql = `
      SELECT
        COALESCE(SUM(duration_seconds), 0) / 60.0 as total_minutes,
        COALESCE(SUM(cost), 0) as total_cost,
        COUNT(*) as call_count,
        0 as sms_count
      FROM calls
      WHERE tenant_id = $1 AND ${dateFilter}
    `;

    const result = await this.queryOne<any>(sql, params);
    return {
      totalMinutes: Math.round(result?.total_minutes || 0),
      totalCost: +(result?.total_cost || 0).toFixed(2),
      callCount: result?.call_count || 0,
      smsCount: result?.sms_count || 0,
    };
  }
}
