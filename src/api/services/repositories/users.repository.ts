/**
 * Users Repository
 *
 * Database operations for profiles table.
 */

import { BaseRepository } from './base.js';

export class UsersRepository extends BaseRepository {
  async getTenantId(userId: string): Promise<string | null> {
    const result = await this.queryOne<{ tenant_id: string }>(
      `SELECT tenant_id FROM profiles WHERE user_id = $1`,
      [userId]
    );
    return result?.tenant_id ?? null;
  }

  async deleteProfile(userId: string): Promise<void> {
    await this.execute(
      `DELETE FROM profiles WHERE user_id = $1`,
      [userId]
    );
  }
}
