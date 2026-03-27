/**
 * Sessions Repository
 *
 * Database operations for sessions
 */

import { BaseRepository } from './base.js';

export interface Session {
  id: string;
  tenant_id: string;
  assistant_id: string | null;
  user_id: string | null;
  status: string;
  context: Record<string, any>;
  metadata: Record<string, any>;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSessionDTO {
  tenant_id: string;
  assistant_id: string;
  user_id?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateSessionDTO {
  status?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
  ended_at?: Date;
}

export interface SessionFilter {
  tenant_id: string;
  assistant_id?: string;
  user_id?: string;
  status?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export class SessionsRepository extends BaseRepository {
  constructor(db: any) {
    super(db);
  }

  async findAll(filter: SessionFilter): Promise<{ sessions: Session[]; total: number }> {
    const { tenant_id, assistant_id, user_id, status, from, to, page = 1, limit = 20 } = filter;
    const offset = (page - 1) * limit;

    let conditions = ['tenant_id = $1'];
    let params: any[] = [tenant_id];
    let paramIndex = 2;

    if (assistant_id) {
      conditions.push(`assistant_id = $${paramIndex++}`);
      params.push(assistant_id);
    }

    if (user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(user_id);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (from) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(from);
    }

    if (to) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(to);
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*) as total
      FROM sessions
      WHERE ${whereClause}
    `;

    const countResult = await this.queryOne<{ total: string }>(countSql, params);
    const total = parseInt(countResult?.total || '0', 10);

    const sql = `
      SELECT *
      FROM sessions
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const sessions = await this.query<Session>(sql, params);

    return { sessions, total };
  }

  async findById(id: string): Promise<Session | null> {
    const sql = 'SELECT * FROM sessions WHERE id = $1';
    return this.queryOne<Session>(sql, [id]);
  }

  async create(dto: CreateSessionDTO): Promise<Session> {
    return this.insert<Session>('sessions', dto);
  }

  async update(id: string, dto: UpdateSessionDTO): Promise<Session | null> {
    const keys = Object.keys(dto);
    const values = Object.values(dto);
    const placeholders = keys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const sql = `
      UPDATE sessions
      SET ${placeholders}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    return this.queryOne<Session>(sql, [...values, id]);
  }

  async delete(id: string): Promise<boolean> {
    return super.delete('sessions', id);
  }

  async exists(id: string): Promise<boolean> {
    return super.exists('sessions', id);
  }

  // End inactive sessions
  async endInactiveSessions(timeoutMinutes = 30): Promise<number> {
    const sql = `
      UPDATE sessions
      SET status = 'inactive',
          ended_at = NOW(),
          updated_at = NOW()
      WHERE status = 'active'
        AND updated_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
      RETURNING id
    `;

    const result = await this.query<{ id: string }>(sql);
    return result.length;
  }

  // Get session with message count
  async getWithMessageCount(id: string): Promise<Session & { message_count: number } | null> {
    const sql = `
      SELECT
        s.*,
        COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id
      WHERE s.id = $1
      GROUP BY s.id
    `;

    return this.queryOne<any>(sql, [id]);
  }

  // Clean up old sessions
  async cleanupOldSessions(daysOld = 30): Promise<number> {
    const sql = `
      DELETE FROM sessions
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      RETURNING id
    `;

    const result = await this.query<{ id: string }>(sql);
    return result.length;
  }
}
