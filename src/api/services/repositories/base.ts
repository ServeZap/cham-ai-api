/**
 * Base Repository
 *
 * Common database operations
 */

import { FastifyInstance } from 'fastify';

export abstract class BaseRepository {
  constructor(protected db: FastifyInstance['pg']) {}

  protected query<T>(sql: string, params?: any[]): Promise<T[]> {
    return this.db.query(sql, params).then((result) => result.rows);
  }

  protected queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    return this.db
      .query(sql, params)
      .then((result) => result.rows[0] || null);
  }

  protected async execute(sql: string, params?: any[]): Promise<void> {
    await this.db.query(sql, params);
  }

  protected async insert<T>(table: string, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    return this.queryOne<T>(sql, values);
  }

  protected async update<T>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const sql = `
      UPDATE ${table}
      SET ${placeholders}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    return this.queryOne<T>(sql, [...values, id]);
  }

  protected async delete(table: string, id: string): Promise<boolean> {
    const sql = `DELETE FROM ${table} WHERE id = $1`;
    const result = await this.db.query(sql, [id]);
    return (result.rowCount || 0) > 0;
  }

  protected async exists(table: string, id: string): Promise<boolean> {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE id = $1)`;
    const result = await this.queryOne<{ exists: boolean }>(sql, [id]);
    return result?.exists || false;
  }
}
