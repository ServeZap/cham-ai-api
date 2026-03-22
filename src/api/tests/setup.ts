/**
 * Test Setup File
 *
 * Global configuration for Vitest tests
 */

import { beforeAll, afterAll } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'file::memory:';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.TWILIO_ACCOUNT_SID = 'AC-test-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-token';

// Mock console methods in test environment to reduce noise
global.console = {
  ...console,
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
};

// Global test timeout
beforeAll(() => {
  // Any global setup before all tests
});

afterAll(() => {
  // Any global cleanup after all tests
});
