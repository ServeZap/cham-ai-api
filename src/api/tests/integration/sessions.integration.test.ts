import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDatabase, initChamAISchema } from '../helpers/test-db.ts';

describe('Sessions Repository Integration Tests', () => {
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
      users: [
        {
          id: 'user-1',
          tenant_id: 'tenant-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          status: 'active',
        },
      ],
      assistants: [
        {
          id: 'assistant-1',
          tenant_id: 'tenant-1',
          name: 'Test Assistant',
          status: 'active',
        },
      ],
    });
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const session = {
        id: 'session-1',
        tenant_id: 'tenant-1',
        assistant_id: 'assistant-1',
        user_id: 'user-1',
        status: 'active',
        context: { messages: [], topic: 'test' },
      };

      const stmt = testDb.db.prepare(`
        INSERT INTO sessions (id, tenant_id, assistant_id, user_id, status, context)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        session.id,
        session.tenant_id,
        session.assistant_id,
        session.user_id,
        session.status,
        JSON.stringify(session.context)
      );

      expect(result.changes).toBe(1);

      const created = testDb.db.prepare('SELECT * FROM sessions WHERE id = ?').get('session-1');
      expect(created).toBeDefined();
      expect((created as any).status).toBe('active');
      expect(JSON.parse((created as any).context || '{}')).toEqual({ messages: [], topic: 'test' });
    });

    it('should create session with optional fields', async () => {
      const session = {
        id: 'session-2',
        tenant_id: 'tenant-1',
        status: 'active',
        context: {},
      };

      const stmt = testDb.db.prepare(`
        INSERT INTO sessions (id, tenant_id, status, context)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(session.id, session.tenant_id, session.status, JSON.stringify(session.context));

      const created = testDb.db.prepare('SELECT * FROM sessions WHERE id = ?').get('session-2');
      expect(created).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update session context', async () => {
      testDb.db.exec(`
        INSERT INTO sessions (id, tenant_id, status, context)
        VALUES ('session-3', 'tenant-1', 'active', '{"messages": []}')
      `);

      const newContext = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        topic: 'greeting',
      };

      const stmt = testDb.db.prepare(`
        UPDATE sessions
        SET context = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(JSON.stringify(newContext), 'session-3');

      const updated = testDb.db.prepare('SELECT * FROM sessions WHERE id = ?').get('session-3');

      expect(JSON.parse((updated as any).context || '{}')).toEqual(newContext);
    });

    it('should close a session', async () => {
      testDb.db.exec(`
        INSERT INTO sessions (id, tenant_id, status, context)
        VALUES ('session-4', 'tenant-1', 'active', '{}')
      `);

      const stmt = testDb.db.prepare(`
        UPDATE sessions
        SET status = 'closed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = stmt.run('session-4');

      expect(result.changes).toBe(1);

      const closed = testDb.db.prepare('SELECT * FROM sessions WHERE id = ?').get('session-4');
      expect((closed as any).status).toBe('closed');
      expect((closed as any).ended_at).toBeDefined();
    });
  });

  describe('endInactiveSessions', () => {
    it('should end sessions inactive for more than 30 minutes', async () => {
      testDb.db.exec(`
        INSERT INTO sessions (id, tenant_id, status, context, updated_at)
        VALUES ('session-5', 'tenant-1', 'active', '{}', datetime('now', '-35 minutes'))
      `);

      testDb.db.exec(`
        INSERT INTO sessions (id, tenant_id, status, context, updated_at)
        VALUES ('session-6', 'tenant-1', 'active', '{}', datetime('now', '-25 minutes'))
      `);

      const stmt = testDb.db.prepare(`
        UPDATE sessions
        SET status = 'inactive',
          ended_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
          AND updated_at < datetime('now', '-30 minutes')
      `);

      const result = stmt.run();

      expect(result.changes).toBe(1);

      const inactive = testDb.db.prepare(`SELECT * FROM sessions WHERE status = 'inactive'`).all();
      expect(inactive).toHaveLength(1);
      expect((inactive[0] as any).id).toBe('session-5');
    });
  });

  describe('cleanupOldSessions', () => {
    it('should delete sessions older than 30 days', async () => {
      testDb.db.exec(`
        INSERT INTO sessions (id, tenant_id, status, context, started_at)
        VALUES
          ('session-old-1', 'tenant-1', 'active', '{}', datetime('now', '-35 days')),
          ('session-old-2', 'tenant-1', 'active', '{}', datetime('now', '-25 days'))
      `);

      const stmt = testDb.db.prepare(`DELETE FROM sessions WHERE started_at < datetime('now', '-30 days')`);
      const result = stmt.run();

      expect(result.changes).toBe(1);

      // Verify session-old-2 (25 days) still exists
      const remaining = testDb.db.prepare(`SELECT * FROM sessions WHERE started_at >= datetime('now', '-30 days')`).all();
      expect(remaining).toHaveLength(1);
      expect((remaining[0] as any).id).toBe('session-old-2');
    });
  });

  describe('Multi-tenancy Isolation', () => {
    beforeEach(() => {
      testDb.db.exec(`
        INSERT INTO tenants (id, name, slug, plan, api_key, status)
        VALUES ('tenant-2', 'Another Tenant', 'tenant-2', 'starter', 'sk-test-key-2', 'active')
      `);

      testDb.db.exec(`
        INSERT INTO sessions (id, tenant_id, status, context)
        VALUES
          ('session-tenant1', 'tenant-1', 'active', '{}'),
          ('session-tenant2', 'tenant-2', 'active', '{}')
      `);
    });

    it('should isolate sessions by tenant', async () => {
      const tenant1Sessions = testDb.db.prepare('SELECT * FROM sessions WHERE tenant_id = ?').all('tenant-1');
      const tenant2Sessions = testDb.db.prepare('SELECT * FROM sessions WHERE tenant_id = ?').all('tenant-2');

      expect(tenant1Sessions).toHaveLength(1);
      expect((tenant1Sessions[0] as any).id).toBe('session-tenant1');

      expect(tenant2Sessions).toHaveLength(1);
      expect((tenant2Sessions[0] as any).id).toBe('session-tenant2');
    });
  });
});
