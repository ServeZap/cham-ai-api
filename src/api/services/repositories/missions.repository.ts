/**
 * Missions Repository
 *
 * Database operations for missions table.
 */

import { BaseRepository } from './base.js';

export interface MissionRow {
  id: string;
  user_id: string;
  tenant_id: string;
  mission_name: string;
  description: string | null;
  target_url: string | null;
  status: string;
  steps: string[];
  logs: Record<string, string>[];
  progress: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionFilter {
  tenant_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class MissionsRepository extends BaseRepository {
  async findAll(filter: MissionFilter = {}): Promise<{ missions: MissionRow[]; total: number }> {
    const { tenant_id, status, page = 1, limit = 50 } = filter;
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM missions ${whereClause}`;
    const countResult = await this.queryOne<{ total: string }>(countSql, params);
    const total = parseInt(countResult?.total || '0', 10);

    const sql = `
      SELECT * FROM missions ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const missions = await this.query<MissionRow>(sql, params);
    return { missions, total };
  }

  async findById(id: string): Promise<MissionRow | null> {
    return this.queryOne<MissionRow>('SELECT * FROM missions WHERE id = $1', [id]);
  }

  async create(data: Partial<MissionRow>): Promise<MissionRow> {
    return this.insert<MissionRow>('missions', data);
  }

  async update(id: string, data: Partial<MissionRow>): Promise<MissionRow | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const sql = `
      UPDATE missions
      SET ${placeholders}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    return this.queryOne<MissionRow>(sql, [...values, id]);
  }

  async updateStatus(id: string, status: string): Promise<MissionRow | null> {
    return this.queryOne<MissionRow>(
      `UPDATE missions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
  }

  async delete(id: string): Promise<boolean> {
    return super.delete('missions', id);
  }
}
