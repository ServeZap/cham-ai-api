/**
 * Health Checks Repository
 *
 * Database operations for historico_health_checks and provider_alerts tables.
 */

import { BaseRepository } from './base.js';

export interface HealthCheckRow {
  id: string;
  provider_name: string;
  provider_label: string;
  status: string;
  latency_ms: number | null;
  version: string | null;
  error: string | null;
  server_details: Record<string, unknown> | null;
  check_timestamp: string;
  created_at: string;
}

export interface ProviderAlert {
  id: string;
  provider_name: string;
  provider_label: string;
  status: string;
  offline_since: string;
  alert_count: number;
  last_alert_sent_at: string | null;
  resolved_at: string | null;
}

export class HealthChecksRepository extends BaseRepository {
  async findRecent(since: string, limit = 1000): Promise<HealthCheckRow[]> {
    return this.query<HealthCheckRow>(
      `SELECT id, provider_name, provider_label, status, latency_ms, version, error, server_details, check_timestamp, created_at
       FROM historico_health_checks
       WHERE check_timestamp >= $1
       ORDER BY check_timestamp ASC
       LIMIT $2`,
      [since, limit]
    );
  }

  async findAlerts(): Promise<ProviderAlert[]> {
    return this.query<ProviderAlert>(
      `SELECT * FROM provider_alerts
       WHERE resolved_at IS NULL
       ORDER BY offline_since DESC`
    );
  }

  async findUptimeHistory(since: string): Promise<HealthCheckRow[]> {
    return this.query<HealthCheckRow>(
      `SELECT * FROM historico_health_checks
       WHERE check_timestamp >= $1
       ORDER BY check_timestamp ASC
       LIMIT 5000`,
      [since]
    );
  }

  async insertCheck(data: {
    provider_name: string;
    provider_label: string;
    status: string;
    latency_ms: number | null;
    version?: string;
    error?: string | null;
    server_details?: Record<string, unknown> | null;
  }): Promise<HealthCheckRow> {
    return this.insert<HealthCheckRow>('historico_health_checks', data);
  }

  async upsertAlert(data: {
    provider_name: string;
    provider_label: string;
    status: string;
  }): Promise<ProviderAlert | null> {
    const existing = await this.queryOne<ProviderAlert>(
      `SELECT * FROM provider_alerts
       WHERE provider_name = $1 AND resolved_at IS NULL`,
      [data.provider_name]
    );

    if (existing) {
      return this.queryOne<ProviderAlert>(
        `UPDATE provider_alerts
         SET status = $1, alert_count = alert_count + 1,
             last_alert_sent_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [data.status, existing.id]
      );
    }

    if (data.status === 'down' || data.status === 'degraded') {
      return this.insert<ProviderAlert>('provider_alerts', {
        provider_name: data.provider_name,
        provider_label: data.provider_label,
        status: data.status,
        offline_since: new Date().toISOString(),
        alert_count: 1,
      });
    }

    return null;
  }

  async resolveAlert(providerName: string): Promise<void> {
    await this.execute(
      `UPDATE provider_alerts SET resolved_at = NOW(), updated_at = NOW()
       WHERE provider_name = $1 AND resolved_at IS NULL`,
      [providerName]
    );
  }
}
