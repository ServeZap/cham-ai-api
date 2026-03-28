/**
 * Demo Repository
 *
 * Database operations for demo_requests table.
 */

import { BaseRepository } from './base.js';

export class DemoRepository extends BaseRepository {
  async insertRequest(data: { name: string; email: string; phone: string | null; company: string | null; message: string | null }): Promise<void> {
    await this.execute(
      `INSERT INTO demo_requests (name, email, phone, company, message) VALUES ($1, $2, $3, $4, $5)`,
      [data.name, data.email, data.phone, data.company, data.message]
    );
  }
}
