/**
 * Test Database Setup Helper - Cham.ai
 *
 * This file extends the shared test database with Cham.ai-specific schemas.
 */

import Database from 'better-sqlite3';
import {
  createTestDatabase as createSharedDatabase,
  TestDatabase as SharedTestDatabase,
  TestSeedData,
  TENANTS_TABLE_SCHEMA,
  USERS_TABLE_SCHEMA,
  AUDIT_LOG_SCHEMA,
} from '@servezap/shared/testing/test-db';

// Cham.ai specific tables
export const CALLS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    direction TEXT CHECK(direction IN ('inbound', 'outbound')),
    status TEXT DEFAULT 'ended',
    duration INTEGER,
    transcription TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );
`;

export const CALLS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_calls_tenant ON calls(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
`;

export const VOICE_MAILS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS voice_mails (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    from_number TEXT NOT NULL,
    duration INTEGER,
    transcription TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );
`;

export const SESSIONS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    assistant_id TEXT,
    user_id TEXT,
    status TEXT DEFAULT 'active',
    context TEXT DEFAULT '{}',
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );
`;

export const SESSIONS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
`;

export const MESSAGES_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    audio_url TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`;

export const MESSAGES_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
`;

export const ASSISTANTS_TABLE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS assistants (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    voice_id TEXT DEFAULT 'default',
    model TEXT DEFAULT 'gpt-4o',
    prompt_template TEXT,
    settings TEXT DEFAULT '{}',
    temperature REAL DEFAULT 0.7,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );
`;

export const ASSISTANTS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_assistants_tenant ON assistants(tenant_id);
`;

export const KNOWLEDGE_BASE_TABLE_SCHEMA = `
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
`;

export const KNOWLEDGE_BASE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_kb_tenant ON knowledge_base(tenant_id);
`;

export const WEBHOOKS_TABLE_SCHEMA = `
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
`;

/**
 * Extended TestDatabase interface with Cham.ai specific methods
 */
export interface TestDatabase extends SharedTestDatabase {
  getCallCount: () => number;
  getVoiceMailCount: () => number;
}

/**
 * Creates a test database with common + Cham.ai specific tables
 */
export function createTestDatabase(customSchemas?: string[]): TestDatabase {
  const tableSchemas = [
    CALLS_TABLE_SCHEMA,
    VOICE_MAILS_TABLE_SCHEMA,
    SESSIONS_TABLE_SCHEMA,
    MESSAGES_TABLE_SCHEMA,
    ASSISTANTS_TABLE_SCHEMA,
    KNOWLEDGE_BASE_TABLE_SCHEMA,
    WEBHOOKS_TABLE_SCHEMA,
  ];

  const indexSchemas = [
    CALLS_INDEXES,
    SESSIONS_INDEXES,
    MESSAGES_INDEXES,
    ASSISTANTS_INDEXES,
    KNOWLEDGE_BASE_INDEXES,
  ];

  const allSchemas = [
    ...tableSchemas,
    ...indexSchemas,
    ...(customSchemas || []),
  ];

  const sharedDb = createSharedDatabase(allSchemas);
  const db = sharedDb.db;

  return {
    ...sharedDb,

    getCallCount: () => {
      const result = db.prepare('SELECT COUNT(*) as count FROM calls').get() as { count: number };
      return result.count;
    },

    getVoiceMailCount: () => {
      const result = db.prepare('SELECT COUNT(*) as count FROM voice_mails').get() as { count: number };
      return result.count;
    },
  };
}

/**
 * Initializes all Cham.ai database tables
 * Used by integration tests
 * Note: Tables are already created by createTestDatabase(), this is for backward compatibility
 */
export function initChamAISchema(db: Database.Database): void {
  // Tables are already created by createTestDatabase with indexes
  // This function is kept for backward compatibility with tests
  // The schemas are now idempotent (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS)
  db.exec(`
    ${CALLS_TABLE_SCHEMA}
    ${VOICE_MAILS_TABLE_SCHEMA}
    ${SESSIONS_TABLE_SCHEMA}
    ${MESSAGES_TABLE_SCHEMA}
    ${ASSISTANTS_TABLE_SCHEMA}
    ${KNOWLEDGE_BASE_TABLE_SCHEMA}
    ${WEBHOOKS_TABLE_SCHEMA}
  `);
}

/**
 * Creates a test call
 */
export function createTestCall(overrides: any = {}): any {
  return {
    id: 'call_test_123',
    tenant_id: 'tenant_test_123',
    from_number: '+15551234567',
    to_number: '+15559876543',
    direction: 'inbound',
    status: 'ended',
    duration: 120,
    transcription: '',
    ...overrides,
  };
}

/**
 * Creates a test voice mail
 */
export function createTestVoiceMail(overrides: any = {}): any {
  return {
    id: 'vm_test_123',
    tenant_id: 'tenant_test_123',
    from_number: '+15551234567',
    duration: 60,
    transcription: 'Hello, this is a test.',
    ...overrides,
  };
}
