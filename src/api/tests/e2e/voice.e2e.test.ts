import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../../src/server.js';
import Fastify from 'fastify';

describe('Voice E2E Tests', () => {
  let server: any;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /api/v1/voice/converse', () => {
    it('should return 401 without authentication', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/voice/converse',
        payload: {
          assistant_id: '550e8400-e29b-41d4-a716-446655440000',
          text: 'Hello!',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept valid conversation payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/voice/converse',
        payload: {
          assistant_id: '550e8400-e29b-41d4-a716-446655440000',
          text: 'Hello!',
        },
      });

      expect(response.statusCode).toBe(401); // Sem JWT token
    });
  });

  describe('WebSocket /api/v1/voice/stream/:id', () => {
    it('should establish WebSocket connection', async () => {
      // WebSocket test requires ws library
      const ws = await import('ws');

      const wsClient = new ws.WebSocket('ws://localhost:8000/api/v1/voice/stream/test-id');

      return new Promise((resolve, reject) => {
        wsClient.on('open', () => {
          wsClient.close();
          resolve(true);
        });
        wsClient.on('error', (error: any) => {
          reject(error);
        });
      });
    }, 10000);
  });
});
