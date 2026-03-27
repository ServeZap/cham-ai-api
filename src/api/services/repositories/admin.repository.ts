/**
 * Admin Repository
 *
 * Database operations for admin endpoints (user_roles, admin_api_keys, profiles).
 */

import { BaseRepository } from './base.js';

/**
 * Parse ADMIN_EMAILS env var into a Set of lowercase emails.
 * God admins bypass ALL permission checks — no DB lookup needed.
 */
export function getGodAdmins(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Check if an email is a god admin (no DB round-trip).
 * Can be used from any route without needing the repository instance.
 */
export function isGodAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getGodAdmins().has(email.toLowerCase());
}

export class AdminRepository extends BaseRepository {
  /**
   * Check if user is admin.
   * God admins (ADMIN_EMAILS env) are always admin regardless of DB state.
   */
  async isAdmin(userIdOrEmail: string): Promise<boolean> {
    // God admin check — by email or by userId
    if (getGodAdmins().has(userIdOrEmail.toLowerCase())) {
      return true;
    }

    const result = await this.queryOne<{ role: string }>(
      `SELECT role FROM user_roles
       WHERE user_id = $1 AND role = 'admin'`,
      [userIdOrEmail]
    );
    return !!result;
  }

  async getOverview(): Promise<{
    totalUsers: number;
    totalCalls: number;
    totalMissions: number;
    activeProviders: number;
  }> {
    const users = await this.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM profiles'
    );
    const calls = await this.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM calls'
    );
    const missions = await this.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM missions'
    );
    const providers = await this.queryOne<{ count: string }>(
      'SELECT COUNT(DISTINCT provider_type) as count FROM provider_registry'
    );

    return {
      totalUsers: parseInt(users?.count || '0', 10),
      totalCalls: parseInt(calls?.count || '0', 10),
      totalMissions: parseInt(missions?.count || '0', 10),
      activeProviders: parseInt(providers?.count || '0', 10),
    };
  }

  async getUsers(limit = 50): Promise<any[]> {
    return this.query(
      `SELECT p.user_id, p.tenant_id, p.display_name, p.email, r.role, p.created_at
       FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.user_id
       ORDER BY p.created_at DESC
       LIMIT $1`,
      [limit]
    );
  }

  async generateApiKey(
    userId: string,
    label: string
  ): Promise<{ id: string; api_key: string; label: string }> {
    const apiKey = `cham_${crypto.randomUUID().replace(/-/g, '')}`;

    const result = await this.queryOne<{ id: string; api_key: string; label: string }>(
      `INSERT INTO admin_api_keys (user_id, api_key, label)
       VALUES ($1, $2, $3)
       RETURNING id, api_key, label`,
      [userId, apiKey, label]
    );

    return result || { id: '', api_key: '', label: '' };
  }
}
