import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDatabase, initChamAISchema } from '../helpers/test-db.ts';

describe('Assistants Repository Integration Tests', () => {
  let testDb: ReturnType<typeof createTestDatabase>;

  beforeAll(async () => {
    testDb = createTestDatabase();
    initChamAISchema(testDb.db);
  });

  afterAll(() => {
    testDb.close();
  });

  beforeEach(() => {
    testDb.reset();
    initChamAISchema(testDb.db);

    // Seed test data
    testDb.seed({
      tenants: [
        {
          id: 'tenant-1',
          name: 'Test Tenant',
          slug: 'test-tenant',
          plan: 'enterprise',
          api_key: 'sk-test-key',
          status: 'active',
        },
      ],
    });
  });

  describe('create', () => {
    it('should create a new assistant', async () => {
      const assistant = {
        id: 'assistant-1',
        tenant_id: 'tenant-1',
        name: 'Customer Support',
        description: 'Helps customers with inquiries',
        voice_id: 'nova',
        model: 'gpt-4o',
        prompt_template: 'You are a helpful assistant.',
        status: 'active',
      };

      const stmt = testDb.db.prepare(`
        INSERT INTO assistants (id, tenant_id, name, description, voice_id, model, prompt_template, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        assistant.id,
        assistant.tenant_id,
        assistant.name,
        assistant.description,
        assistant.voice_id,
        assistant.model,
        assistant.prompt_template,
        assistant.status
      );

      expect(result.changes).toBe(1);

      const created = testDb.db.prepare('SELECT * FROM assistants WHERE id = ?').get('assistant-1');
      expect(created).toBeDefined();
      expect(created?.name).toBe('Customer Support');
      expect(created?.voice_id).toBe('nova');
      expect(created?.model).toBe('gpt-4o');
    });

    it('should create assistant with default values', async () => {
      const assistant = {
        id: 'assistant-2',
        tenant_id: 'tenant-1',
        name: 'Default Assistant',
        status: 'active',
      };

      const stmt = testDb.db.prepare(`
        INSERT INTO assistants (id, tenant_id, name, status)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(assistant.id, assistant.tenant_id, assistant.name, assistant.status);

      const created = testDb.db.prepare('SELECT * FROM assistants WHERE id = ?').get('assistant-2');
      expect(created).toBeDefined();
      expect((created as any).voice_id).toBe('default');
      expect((created as any).model).toBe('gpt-4o');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      testDb.db.exec(`
        INSERT INTO assistants (id, tenant_id, name, description, voice_id, model, status)
        VALUES ('assistant-3', 'tenant-1', 'Test Assistant', 'Old description', 'default', 'gpt-4o', 'active')
      `);
    });

    it('should update assistant fields', () => {
      const stmt = testDb.db.prepare(`
        UPDATE assistants
        SET name = ?, description = ?, voice_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run('Updated Assistant', 'New description', 'nova', 'assistant-3');

      const updated = testDb.db.prepare('SELECT * FROM assistants WHERE id = ?').get('assistant-3');
      expect((updated as any).name).toBe('Updated Assistant');
      expect((updated as any).description).toBe('New description');
      expect((updated as any).voice_id).toBe('nova');
    });

    it('should deactivate an assistant', () => {
      const stmt = testDb.db.prepare(`
        UPDATE assistants
        SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run('assistant-3');

      const updated = testDb.db.prepare('SELECT * FROM assistants WHERE id = ?').get('assistant-3');
      expect((updated as any).status).toBe('inactive');
    });
  });

  describe('find', () => {
    beforeEach(() => {
      testDb.db.exec(`
        INSERT INTO assistants (id, tenant_id, name, description, voice_id, model, status)
        VALUES
          ('assistant-4', 'tenant-1', 'Support Agent', 'Customer support', 'nova', 'gpt-4o', 'active'),
          ('assistant-5', 'tenant-1', 'Sales Agent', 'Sales qualification', 'echo', 'gpt-4o', 'active'),
          ('assistant-6', 'tenant-1', 'Inactive Agent', 'Inactive agent', 'alloy', 'gpt-4o', 'inactive')
      `);
    });

    it('should find all active assistants for tenant', () => {
      const assistants = testDb.db
        .prepare('SELECT * FROM assistants WHERE tenant_id = ? AND status = ? ORDER BY created_at')
        .all('tenant-1', 'active');

      expect(assistants).toHaveLength(2);
      expect((assistants[0] as any).name).toBe('Support Agent');
      expect((assistants[1] as any).name).toBe('Sales Agent');
    });

    it('should find assistant by id', () => {
      const assistant = testDb.db
        .prepare('SELECT * FROM assistants WHERE id = ?')
        .get('assistant-4');

      expect(assistant).toBeDefined();
      expect((assistant as any).name).toBe('Support Agent');
    });

    it('should return null for non-existent assistant', () => {
      const assistant = testDb.db
        .prepare('SELECT * FROM assistants WHERE id = ?')
        .get('non-existent');

      expect(assistant).toBeUndefined();
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      testDb.db.exec(`
        INSERT INTO assistants (id, tenant_id, name, status)
        VALUES ('assistant-7', 'tenant-1', 'To Delete', 'active')
      `);
    });

    it('should delete an assistant', () => {
      const stmt = testDb.db.prepare('DELETE FROM assistants WHERE id = ?');
      const result = stmt.run('assistant-7');

      expect(result.changes).toBe(1);

      const deleted = testDb.db.prepare('SELECT * FROM assistants WHERE id = ?').get('assistant-7');
      expect(deleted).toBeUndefined();
    });

    it('should return 0 changes when deleting non-existent assistant', () => {
      const stmt = testDb.db.prepare('DELETE FROM assistants WHERE id = ?');
      const result = stmt.run('non-existent');

      expect(result.changes).toBe(0);
    });
  });

  describe('Multi-tenancy Isolation', () => {
    beforeEach(() => {
      testDb.db.exec(`
        INSERT INTO tenants (id, name, slug, plan, api_key, status)
        VALUES ('tenant-2', 'Another Tenant', 'tenant-2', 'starter', 'sk-test-key-2', 'active')
      `);

      testDb.db.exec(`
        INSERT INTO assistants (id, tenant_id, name, status)
        VALUES
          ('assistant-8', 'tenant-1', 'Tenant 1 Assistant', 'active'),
          ('assistant-9', 'tenant-2', 'Tenant 2 Assistant', 'active')
      `);
    });

    it('should isolate assistants by tenant', () => {
      const tenant1Assistants = testDb.db
        .prepare('SELECT * FROM assistants WHERE tenant_id = ?')
        .all('tenant-1');

      const tenant2Assistants = testDb.db
        .prepare('SELECT * FROM assistants WHERE tenant_id = ?')
        .all('tenant-2');

      expect(tenant1Assistants).toHaveLength(1);
      expect(tenant2Assistants).toHaveLength(1);
      expect((tenant1Assistants[0] as any).id).toBe('assistant-8');
      expect((tenant2Assistants[0] as any).id).toBe('assistant-9');
    });
  });

  describe('Settings JSON', () => {
    it('should store and retrieve settings as JSON', () => {
      const settings = {
        temperature: 0.7,
        maxTokens: 1000,
        language: 'pt-BR',
      };

      testDb.db.exec(`
        INSERT INTO assistants (id, tenant_id, name, settings, status)
        VALUES ('assistant-10', 'tenant-1', 'JSON Assistant', '${JSON.stringify(settings)}', 'active')
      `);

      const assistant = testDb.db.prepare('SELECT * FROM assistants WHERE id = ?').get('assistant-10') as any;

      expect(assistant.settings).toBeDefined();
      const parsedSettings = JSON.parse(assistant.settings);
      expect(parsedSettings.temperature).toBe(0.7);
      expect(parsedSettings.maxTokens).toBe(1000);
      expect(parsedSettings.language).toBe('pt-BR');
    });
  });
});
