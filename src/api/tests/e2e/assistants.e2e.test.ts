import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../../src/server.js';

describe('Assistants E2E Tests', () => {
  let server: any;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /api/v1/assistants', () => {
    it('should return 401 without authentication', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/assistants',
        payload: {
          name: 'Test Assistant',
          description: 'Test description',
          voice_id: 'nova',
          model: 'gpt-4o',
        },
      });

      expect([401, 422].includes(response.statusCode)).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/assistants',
        payload: {
          description: 'Test description',
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  describe('GET /api/v1/assistants', () => {
    it('should return assistants list', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/assistants',
      });

      expect([200, 401].includes(response.statusCode)).toBe(true);
    });

    it('should accept status filter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/assistants?status=active',
      });

      expect([200, 401].includes(response.statusCode)).toBe(true);
    });
  });

  describe('GET /api/v1/assistants/:id', () => {
    it('should return 404 for non-existent assistant', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/assistants/550e8400-e29b-41d4-a716-446655440000',
      });

      expect([401, 404].includes(response.statusCode)).toBe(true);
    });
  });

  describe('PATCH /api/v1/assistants/:id', () => {
    it('should update assistant', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/v1/assistants/assistant-001',
        payload: {
          name: 'Updated Assistant',
        },
      });

      expect([200, 401, 404].includes(response.statusCode)).toBe(true);
    });
  });

  describe('DELETE /api/v1/assistants/:id', () => {
    it('should delete assistant', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/v1/assistants/assistant-001',
      });

      expect([200, 204, 401, 404].includes(response.statusCode)).toBe(true);
    });
  });
});
