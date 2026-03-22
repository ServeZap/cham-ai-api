/**
 * Test Database Setup Helper
 *
 * Helper para configurar banco de dados em memória para testes de integração
 */

import Database from 'better-sqlite3';

export interface TestDatabase {
  db: Database.Database;
  close: () => void;
  reset: () => void;
  seed: (data?: any) => void;
}

/**
 * Creates an in-memory SQLite database for testing
 */
export function createTestDatabase(): TestDatabase {
  const db = new Database(':memory:');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  return {
    db,
    close: () => db.close(),
    reset: () => {
      // Drop all tables safely - ignore if no tables exist yet
      try {
        const tables = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
          )
          .all() as { name: string }[];
        tables.forEach((table) => {
          db.exec(`DROP TABLE IF EXISTS ${table.name}`);
        });
      } catch (e) {
        // Ignore errors if no tables exist yet
      }
    },
    seed: (data?: any) => {
      // Seed with test data
      if (data?.tenants) {
        const insertTenant = db.prepare(`
          INSERT INTO tenants (id, name, slug, plan, api_key, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.tenants.forEach((tenant: any) => {
          insertTenant.run(
            tenant.id,
            tenant.name,
            tenant.slug,
            tenant.plan,
            tenant.api_key,
            tenant.status,
            tenant.created_at || new Date().toISOString(),
            tenant.updated_at || new Date().toISOString()
          );
        });
      }

      if (data?.users) {
        const insertUser = db.prepare(`
          INSERT INTO users (id, tenant_id, email, name, role, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.users.forEach((user: any) => {
          insertUser.run(
            user.id,
            user.tenant_id,
            user.email,
            user.name,
            user.role,
            user.status,
            user.created_at || new Date().toISOString(),
            user.updated_at || new Date().toISOString()
          );
        });
      }

      if (data?.assistants) {
        const insertAssistant = db.prepare(`
          INSERT INTO assistants (id, tenant_id, name, description, voice_id, model, prompt_template, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.assistants.forEach((assistant: any) => {
          insertAssistant.run(
            assistant.id,
            assistant.tenant_id,
            assistant.name,
            assistant.description || '',
            assistant.voice_id || 'default',
            assistant.model || 'gpt-4o',
            assistant.prompt_template || '',
            assistant.status,
            assistant.created_at || new Date().toISOString(),
            assistant.updated_at || new Date().toISOString()
          );
        });
      }

      if (data?.sessions) {
        const insertSession = db.prepare(`
          INSERT INTO sessions (id, tenant_id, assistant_id, user_id, status, context, started_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.sessions.forEach((session: any) => {
          insertSession.run(
            session.id,
            session.tenant_id,
            session.assistant_id,
            session.user_id,
            session.status,
            typeof session.context === 'string' ? session.context : JSON.stringify(session.context),
            session.started_at || new Date().toISOString(),
            session.updated_at || new Date().toISOString()
          );
        });
      }

      if (data?.messages) {
        const insertMessage = db.prepare(`
          INSERT INTO messages (id, session_id, role, content, audio_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        data.messages.forEach((message: any) => {
          insertMessage.run(
            message.id,
            message.session_id,
            message.role,
            message.content,
            message.audio_url,
            message.created_at || new Date().toISOString()
          );
        });
      }

      if (data?.calls) {
        const insertCall = db.prepare(`
          INSERT INTO calls (id, tenant_id, session_id, assistant_id, direction, phone_number, status, duration_seconds, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.calls.forEach((call: any) => {
          insertCall.run(
            call.id,
            call.tenant_id,
            call.session_id,
            call.assistant_id,
            call.direction,
            call.phone_number,
            call.status,
            call.duration_seconds || 0,
            call.created_at || new Date().toISOString(),
            call.updated_at || new Date().toISOString()
          );
        });
      }
    },
  };
}

/**
 * Initialize Cham.ai database schema for testing
 */
export function initChamAISchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      plan TEXT DEFAULT 'starter',
      api_key TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assistants (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      voice_id TEXT DEFAULT 'default',
      model TEXT DEFAULT 'gpt-4o',
      prompt_template TEXT,
      settings TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      assistant_id TEXT,
      user_id TEXT,
      status TEXT DEFAULT 'active',
      context TEXT DEFAULT '{}',
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      audio_url TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      session_id TEXT,
      assistant_id TEXT NOT NULL,
      direction TEXT DEFAULT 'inbound',
      phone_number TEXT NOT NULL,
      status TEXT DEFAULT 'ringing',
      duration_seconds INTEGER DEFAULT 0,
      recording_url TEXT,
      transcription TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
      FOREIGN KEY (assistant_id) REFERENCES assistants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      session_id TEXT,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      tags TEXT DEFAULT '[]',
      embedding BLOB,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT,
      status TEXT DEFAULT 'active',
      last_triggered_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      changes TEXT DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_calls_tenant ON calls(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
    CREATE INDEX IF NOT EXISTS idx_usage_tenant_metric ON usage_logs(tenant_id, metric);
    CREATE INDEX IF NOT EXISTS idx_kb_tenant ON knowledge_base(tenant_id);
  `);
}
