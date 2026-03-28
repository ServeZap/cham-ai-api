import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventsRoutes } from '../../../src/routes/events.js';

describe('Events Routes', () => {
  let mockFastify: any;
  let mockReply: any;
  let getHandlers: any[];

  beforeEach(async () => {
    process.env.ADMIN_EMAILS = 'hector.eng@gmail.com';
    getHandlers = [];
    mockFastify = {
      get: vi.fn((path, handler) => {
        getHandlers.push({ path, handler });
      }),
      eventBus: {
        subscribe: vi.fn(() => vi.fn()),
      },
    };
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      raw: {
        writeHead: vi.fn(),
        write: vi.fn(),
      },
    };

    await eventsRoutes(mockFastify);
  });

  describe('GET /', () => {
    let handler: any;

    beforeEach(() => {
      handler = getHandlers.find((h) => h.path === '/')?.handler;
    });

    it('rejects requests without tenant param', async () => {
      await expect(
        handler({ query: {}, user: { app_metadata: { tenant_id: 't1' } } }, mockReply)
      ).rejects.toThrow('Required');
    });

    it('rejects requests with empty tenant param', async () => {
      await expect(
        handler({ query: { tenant: '' }, user: { app_metadata: { tenant_id: 't1' } } }, mockReply)
      ).rejects.toThrow('at least 1 character');
    });

    it('rejects cross-tenant subscription', async () => {
      const mockReply2 = {
        raw: {
          writeHead: vi.fn(),
          write: vi.fn(),
          on: vi.fn(),
        },
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await handler(
        { query: { tenant: 'other-tenant' }, user: { app_metadata: { tenant_id: 't1' } }, raw: { on: vi.fn() } },
        mockReply2
      );

      expect(mockReply2.status).toHaveBeenCalledWith(403);
      expect(mockReply2.send).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN' })
      );
      expect(mockReply2.raw.writeHead).not.toHaveBeenCalled();
    });

    it('allows same-tenant subscription', async () => {
      const mockClose = vi.fn();
      await handler(
        {
          query: { tenant: 't1' },
          user: { app_metadata: { tenant_id: 't1' } },
          raw: { on: vi.fn((event, cb) => { if (event === 'close') cb(); }) },
        },
        mockReply
      );

      expect(mockReply.raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));
    });

    it('denies subscription when user has no tenant_id', async () => {
      await handler(
        {
          query: { tenant: 't1' },
          user: {},
          raw: { on: vi.fn() },
        },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });

    it('passes types filter to query', async () => {
      await handler(
        {
          query: { tenant: 't1', types: 'call.status_changed,call.ended' },
          user: { app_metadata: { tenant_id: 't1' } },
          raw: { on: vi.fn() },
        },
        mockReply
      );

      expect(mockFastify.eventBus.subscribe).toHaveBeenCalledWith(
        'cham-ai:calls:t1',
        expect.any(Function)
      );
    });

    it('god admin bypasses tenant isolation', async () => {
      await handler(
        {
          query: { tenant: 'other-tenant' },
          user: { email: 'hector.eng@gmail.com', app_metadata: { tenant_id: 't1' } },
          raw: { on: vi.fn() },
        },
        mockReply
      );

      expect(mockReply.raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));
      expect(mockFastify.eventBus.subscribe).toHaveBeenCalledWith(
        'cham-ai:calls:other-tenant',
        expect.any(Function)
      );
    });
  });
});
