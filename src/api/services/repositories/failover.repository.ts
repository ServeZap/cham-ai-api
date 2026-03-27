/**
 * Failover Repository
 *
 * Database operations for failover_notification_config and failover_notification_log tables.
 */

import { BaseRepository } from './base.js';

export interface NotificationConfig {
  id: string;
  channel: 'webhook' | 'email';
  target: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FailoverLogEntry {
  id: string;
  provider_type: string;
  failed_provider: string;
  active_provider: string;
  failover_chain: string[];
  failed_providers: { name: string; reason: string }[];
  gpu_failure: boolean;
  action_path: string | null;
  triggered_at: string;
  notifications_sent: { channel: string; target: string; success: boolean; error?: string }[];
}

export class FailoverRepository extends BaseRepository {
  async findConfigs(): Promise<NotificationConfig[]> {
    return this.query<NotificationConfig>(
      `SELECT * FROM failover_notification_config ORDER BY created_at DESC`
    );
  }

  async findLogs(limit = 50): Promise<FailoverLogEntry[]> {
    return this.query<FailoverLogEntry>(
      `SELECT * FROM failover_notification_log ORDER BY triggered_at DESC LIMIT $1`,
      [limit]
    );
  }

  async insertConfig(data: {
    channel: string;
    target: string;
    enabled: boolean;
  }): Promise<NotificationConfig> {
    return this.insert<NotificationConfig>('failover_notification_config', data);
  }

  async toggleConfig(id: string, enabled: boolean): Promise<void> {
    await this.execute(
      `UPDATE failover_notification_config SET enabled = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, id]
    );
  }

  async deleteConfig(id: string): Promise<boolean> {
    return this.delete('failover_notification_config', id);
  }
}
