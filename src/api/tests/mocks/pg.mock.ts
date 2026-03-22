/**
 * PostgreSQL Pool Mock
 *
 * Mock para pg Pool usado em testes unitários de repositories
 */

import { vi } from 'vitest';

export interface MockQueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

export class MockPool {
  private queryResponses: Map<string, MockQueryResult> = new Map();
  private queryHistory: Array<{ sql: string; params: any[] }> = [];

  /**
   * Set a mock response for a specific SQL query
   */
  setMockResponse<T>(sql: string, response: MockQueryResult<T>): void {
    this.queryResponses.set(sql, response);
  }

  /**
   * Mock the query method
   */
  query = vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
    this.queryHistory.push({ sql, params });

    // Check for exact SQL match
    if (this.queryResponses.has(sql)) {
      return this.queryResponses.get(sql);
    }

    // Check for pattern match
    for (const [key, value] of this.queryResponses.entries()) {
      if (sql.includes(key) || sql.match(new RegExp(key))) {
        return value;
      }
    }

    // Default empty response
    return { rows: [], rowCount: 0 };
  });

  /**
   * Get query history for assertions
   */
  getQueryHistory(): Array<{ sql: string; params: any[] }> {
    return this.queryHistory;
  }

  /**
   * Clear query history and mock responses
   */
  reset(): void {
    this.queryHistory = [];
    this.queryResponses.clear();
    this.query.mockClear();
  }

  /**
   * Get last query
   */
  getLastQuery(): { sql: string; params: any[] } | undefined {
    return this.queryHistory[this.queryHistory.length - 1];
  }
}

/**
 * Create a mock pg Pool instance
 */
export function createMockPool(): MockPool & { query: any } {
  const pool = new MockPool() as any;
  return pool;
}

/**
 * Vitest mock for pg module
 */
vi.mock('pg', () => ({
  default: {
    Pool: vi.fn().mockImplementation(() => createMockPool()),
  },
  Pool: vi.fn().mockImplementation(() => createMockPool()),
}));
