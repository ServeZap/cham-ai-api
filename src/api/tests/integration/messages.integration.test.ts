import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDatabase, initChamAISchema } from '../helpers/test-db.js';

describe('Messages Repository Integration Tests', () => {
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
      sessions: [
        {
          id: 'session-1',
          tenant_id: 'tenant-1',
          assistant_id: 'assistant-1',
          user_id: 'user-1',
          status: 'active',
          context: { messages: [], topic: 'test' },
        },
      ],
    });
  });

  describe('create', () => {
    it('should create a text message', async () => {
      const message = {
        id: 'msg-1',
        session_id: 'session-1',
        role: 'user',
        content: 'Hello, how are you?',
      };

      const stmt = testDb.db.prepare(`
        INSERT INTO messages (id, session_id, role, content)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(message.id, message.session_id, message.role, message.content);

      expect(result.changes).toBe(1);

      const created = testDb.db.prepare('SELECT * FROM messages WHERE id = ?').get('msg-1');
      expect(created).toBeDefined();
      expect((created as any).role).toBe('user');
      expect((created as any).content).toBe('Hello, how are you?');
      expect((created as any).audio_url).toBeNull();
    });

    it('should create a voice message with audio URL', async () => {
      const message = {
        id: 'msg-2',
        session_id: 'session-1',
        role: 'user',
        audio_url: 'https://api.openai.com/v1/audio/speech/abc123',
      };

      const stmt = testDb.db.prepare(`
        INSERT INTO messages (id, session_id, role, audio_url)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(message.id, message.session_id, message.role, message.audio_url);

      const created = testDb.db.prepare('SELECT * FROM messages WHERE id = ?').get('msg-2') as any;
      expect(created.role).toBe('user');
      expect(created.audio_url).toBe('https://api.openai.com/v1/audio/speech/abc123');
      expect(created.content).toBeNull();
    });

    it('should create an assistant message', async () => {
      const message = {
        id: 'msg-3',
        session_id: 'session-1',
        role: 'assistant',
        content: 'I am doing well, thank you!',
      };

      const stmt = testDb.db.prepare(`
        INSERT INTO messages (id, session_id, role, content)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(message.id, message.session_id, message.role, message.content);

      const created = testDb.db.prepare('SELECT * FROM messages WHERE id = ?').get('msg-3') as any;
      expect(created.role).toBe('assistant');
      expect(created.content).toBe('I am doing well, thank you!');
    });
  });

  describe('findBySession', () => {
    beforeEach(() => {
      testDb.db.exec(`
        INSERT INTO messages (id, session_id, role, content)
        VALUES
          ('msg-4', 'session-1', 'user', 'First message'),
          ('msg-5', 'session-1', 'assistant', 'First response'),
          ('msg-6', 'session-1', 'user', 'Second message'),
          ('msg-7', 'session-1', 'assistant', 'Second response')
      `);
    });

    it('should get all messages for a session ordered by created_at', () => {
      const messages = testDb.db
        .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at')
        .all('session-1');

      expect(messages).toHaveLength(4);
      expect((messages[0] as any).content).toBe('First message');
      expect((messages[1] as any).content).toBe('First response');
      expect((messages[2] as any).content).toBe('Second message');
      expect((messages[3] as any).content).toBe('Second response');
    });

    it('should return empty array for session with no messages', () => {
      testDb.db.exec(`
        INSERT INTO sessions (id, tenant_id, status)
        VALUES ('session-empty', 'tenant-1', 'active')
      `);

      const messages = testDb.db
        .prepare('SELECT * FROM messages WHERE session_id = ?')
        .all('session-empty');

      expect(messages).toHaveLength(0);
    });
  });

  describe('metadata', () => {
    it('should store and retrieve metadata as JSON', () => {
      const metadata = {
        tokens: 50,
        model: 'gpt-4o',
        latency_ms: 1200,
      };

      testDb.db.exec(`
        INSERT INTO messages (id, session_id, role, content, metadata)
        VALUES ('msg-8', 'session-1', 'assistant', 'Test message', '${JSON.stringify(metadata)}')
      `);

      const message = testDb.db.prepare('SELECT * FROM messages WHERE id = ?').get('msg-8') as any;

      expect(message.metadata).toBeDefined();
      const parsedMetadata = JSON.parse(message.metadata);
      expect(parsedMetadata.tokens).toBe(50);
      expect(parsedMetadata.model).toBe('gpt-4o');
      expect(parsedMetadata.latency_ms).toBe(1200);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      testDb.db.exec(`
        INSERT INTO messages (id, session_id, role, content)
        VALUES ('msg-9', 'session-1', 'user', 'To be deleted')
      `);
    });

    it('should delete a message', () => {
      const stmt = testDb.db.prepare('DELETE FROM messages WHERE id = ?');
      const result = stmt.run('msg-9');

      expect(result.changes).toBe(1);

      const deleted = testDb.db.prepare('SELECT * FROM messages WHERE id = ?').get('msg-9');
      expect(deleted).toBeUndefined();
    });

    it('should cascade delete when session is deleted', () => {
      // Create a message that will be cascade deleted
      testDb.db.exec(`
        INSERT INTO messages (id, session_id, role, content)
        VALUES ('msg-cascade', 'session-1', 'user', 'Cascade test')
      `);

      // Delete the session
      testDb.db.prepare('DELETE FROM sessions WHERE id = ?').run('session-1');

      // Message should be deleted due to CASCADE
      const messages = testDb.db.prepare('SELECT * FROM messages WHERE session_id = ?').all('session-1');
      expect(messages).toHaveLength(0);
    });
  });

  describe('countByRole', () => {
    beforeEach(() => {
      testDb.db.exec(`
        INSERT INTO messages (id, session_id, role, content)
        VALUES
          ('msg-10', 'session-1', 'user', 'User message 1'),
          ('msg-11', 'session-1', 'user', 'User message 2'),
          ('msg-12', 'session-1', 'assistant', 'Assistant message 1'),
          ('msg-13', 'session-1', 'assistant', 'Assistant message 2'),
          ('msg-14', 'session-1', 'assistant', 'Assistant message 3')
      `);
    });

    it('should count messages by role for a session', () => {
      const counts = testDb.db
        .prepare(`
          SELECT role, COUNT(*) as count
          FROM messages
          WHERE session_id = ?
          GROUP BY role
        `)
        .all('session-1');

      const userCount = counts.find((c: any) => c.role === 'user');
      const assistantCount = counts.find((c: any) => c.role === 'assistant');

      expect(userCount?.count).toBe(2);
      expect(assistantCount?.count).toBe(3);
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      // Create 20 messages
      for (let i = 1; i <= 20; i++) {
        testDb.db
          .prepare(`INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`)
          .run(`msg-${i}`, 'session-1', 'user', `Message ${i}`);
      }
    });

    it('should paginate messages', () => {
      const page = 2;
      const limit = 5;
      const offset = (page - 1) * limit;

      const messages = testDb.db
        .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at LIMIT ? OFFSET ?')
        .all('session-1', limit, offset);

      expect(messages).toHaveLength(5);

      // Get total count
      const total = testDb.db
        .prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?')
        .get('session-1') as { count: number };
      expect(total.count).toBe(20);
    });
  });
});
