/**
 * Provider Registry Repository
 *
 * Database operations for provider_registry and profiles tables.
 */

import { BaseRepository } from './base.js';

export interface RegistryEntry {
  id: string;
  tenant_id: string;
  provider_type: string;
  active_provider: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class ProviderRegistryRepository extends BaseRepository {
  async findAll(): Promise<RegistryEntry[]> {
    return this.query<RegistryEntry>(
      'SELECT * FROM provider_registry ORDER BY provider_type'
    );
  }

  async findByType(providerType: string): Promise<RegistryEntry | null> {
    return this.queryOne<RegistryEntry>(
      'SELECT * FROM provider_registry WHERE provider_type = $1',
      [providerType]
    );
  }

  async upsert(
    tenantId: string,
    providerType: string,
    activeProvider: string,
    config: Record<string, unknown> = {}
  ): Promise<RegistryEntry> {
    // Try update first
    const existing = await this.findByType(providerType);
    if (existing) {
      const updated = await this.queryOne<RegistryEntry>(
        `UPDATE provider_registry
         SET active_provider = $1, config = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [activeProvider, JSON.stringify(config), existing.id]
      );
      return updated!;
    }

    // Insert new
    return this.insert<RegistryEntry>('provider_registry', {
      tenant_id: tenantId,
      provider_type: providerType,
      active_provider: activeProvider,
      config: config as Record<string, unknown>,
    });
  }

  async getTenantId(userId: string): Promise<string | null> {
    const result = await this.queryOne<{ tenant_id: string }>(
      'SELECT tenant_id FROM profiles WHERE user_id = $1',
      [userId]
    );
    return result?.tenant_id || null;
  }
}
