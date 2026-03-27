import { describe, it, expect, beforeEach, vi } from 'vitest';
import { demoRoutes } from '../../../src/routes/demo.js';

describe('Demo Routes', () => {
  let mockFastify: any;
  let postHandlers: any[];

  beforeEach(async () => {
    postHandlers = [];
    mockFastify = {
      post: vi.fn((path, handler) => { postHandlers.push({ path, handler }); }),
      pg: {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      },
    };

    await demoRoutes(mockFastify);
  });

  describe('POST /requests', () => {
    it('inserts a demo request', async () => {
      const handler = postHandlers.find((h) => h.path === '/requests')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

      await handler(
        { body: { name: 'Test', email: 'test@example.com', phone: null, company: null, message: null } },
        mockReply
      );

      expect(mockFastify.pg.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO demo_requests'),
        ['Test', 'test@example.com', null, null, null]
      );
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({ success: true });
    });

    it('rejects invalid email', async () => {
      const handler = postHandlers.find((h) => h.path === '/requests')?.handler;
      await expect(
        handler({ body: { name: 'Test', email: 'not-an-email' } }, {})
      ).rejects.toThrow();
    });

    it('rejects missing name', async () => {
      const handler = postHandlers.find((h) => h.path === '/requests')?.handler;
      await expect(
        handler({ body: { email: 'test@example.com' } }, {})
      ).rejects.toThrow();
    });
  });
});
