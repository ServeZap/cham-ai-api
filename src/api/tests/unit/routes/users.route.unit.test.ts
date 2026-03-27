import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usersRoutes } from '../../../src/routes/users.js';

describe('Users Routes', () => {
  let mockFastify: any;
  let getHandlers: any[];
  let deleteHandlers: any[];

  beforeEach(async () => {
    getHandlers = [];
    deleteHandlers = [];
    mockFastify = {
      get: vi.fn((path, handler) => { getHandlers.push({ path, handler }); }),
      delete: vi.fn((path, handler) => { deleteHandlers.push({ path, handler }); }),
      pg: {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      },
    };

    await usersRoutes(mockFastify);
  });

  describe('GET /tenant-id', () => {
    it('returns tenant_id for authenticated user', async () => {
      mockFastify.pg.query = vi.fn().mockResolvedValue({ rows: [{ tenant_id: 'tenant-123' }] });

      const handler = getHandlers.find((h) => h.path === '/tenant-id')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      const result = await handler(
        { user: { sub: 'user-uuid' } },
        mockReply
      );

      expect(result.tenant_id).toBe('tenant-123');
    });

    it('returns 401 when no user in JWT', async () => {
      const handler = getHandlers.find((h) => h.path === '/tenant-id')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await handler({ user: {} }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
    });

    it('returns 404 when profile not found', async () => {
      mockFastify.pg.query = vi.fn().mockResolvedValue({ rows: [] });

      const handler = getHandlers.find((h) => h.path === '/tenant-id')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await handler(
        { user: { sub: 'unknown-user' } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /profile', () => {
    it('deletes own profile', async () => {
      const handler = deleteHandlers.find((h) => h.path === '/profile')?.handler;

      const result = await handler(
        { user: { sub: 'user-uuid' } },
        {}
      );

      expect(mockFastify.pg.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM profiles'),
        ['user-uuid']
      );
      expect(result.deleted).toBe(true);
    });

    it('returns 401 when no user in JWT', async () => {
      const handler = deleteHandlers.find((h) => h.path === '/profile')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await handler({ user: {} }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
    });
  });
});
