import { describe, it, expect, beforeEach, vi } from 'vitest';
import { failoverRoutes } from '../../../src/routes/failover.js';

describe('Failover Routes', () => {
  let mockFastify: any;
  let getHandlers: any[];
  let postHandlers: any[];
  let patchHandlers: any[];
  let deleteHandlers: any[];
  const GOD_ADMIN_EMAIL = 'hector.eng@gmail.com';

  beforeEach(async () => {
    process.env.ADMIN_EMAILS = GOD_ADMIN_EMAIL;
    getHandlers = [];
    postHandlers = [];
    patchHandlers = [];
    deleteHandlers = [];
    mockFastify = {
      get: vi.fn((path, handler) => { getHandlers.push({ path, handler }); }),
      post: vi.fn((path, handler) => { postHandlers.push({ path, handler }); }),
      patch: vi.fn((path, handler) => { patchHandlers.push({ path, handler }); }),
      delete: vi.fn((path, handler) => { deleteHandlers.push({ path, handler }); }),
      repositories: {
        failover: {
          findConfigs: vi.fn().mockResolvedValue([
            { id: '1', channel: 'webhook', target: 'https://hooks.example.com', enabled: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
          ]),
          findLogs: vi.fn().mockResolvedValue([
            { id: '1', provider_type: 'stt', failed_provider: 'whisper', active_provider: 'deepgram', triggered_at: '2024-01-01T00:00:00Z', failover_chain: ['whisper', 'deepgram'], failed_providers: [{ name: 'whisper', reason: 'timeout' }], gpu_failure: false, action_path: null, notifications_sent: [] },
          ]),
          insertConfig: vi.fn().mockResolvedValue({ id: '2', channel: 'email', target: 'ops@test.com', enabled: true }),
          toggleConfig: vi.fn().mockResolvedValue(undefined),
          deleteConfig: vi.fn().mockResolvedValue(true),
        },
        admin: {
          isAdmin: vi.fn().mockResolvedValue(false),
        },
      },
    };

    await failoverRoutes(mockFastify);
  });

  describe('GET /configs', () => {
    it('returns list of notification configs', async () => {
      const handler = getHandlers.find((h) => h.path === '/configs')?.handler;
      const result = await handler({}, {});

      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].channel).toBe('webhook');
    });
  });

  describe('GET /logs', () => {
    it('returns list of failover logs', async () => {
      const handler = getHandlers.find((h) => h.path === '/logs')?.handler;
      const result = await handler({ query: {} }, {});

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].failed_provider).toBe('whisper');
    });

    it('accepts limit parameter', async () => {
      const handler = getHandlers.find((h) => h.path === '/logs')?.handler;
      await handler({ query: { limit: '10' } }, {});

      expect(mockFastify.repositories.failover.findLogs).toHaveBeenCalledWith(10);
    });
  });

  describe('POST /configs', () => {
    it('creates a new notification config', async () => {
      const handler = postHandlers.find((h) => h.path === '/configs')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

      // Mock admin repo to allow this user
      mockFastify.repositories.admin.isAdmin.mockResolvedValue(true);

      await handler(
        { body: { channel: 'email', target: 'ops@test.com', enabled: true }, user: { sub: 'user-1', email: 'user@test.com' } },
        mockReply
      );

      expect(mockFastify.repositories.failover.insertConfig).toHaveBeenCalledWith({
        channel: 'email',
        target: 'ops@test.com',
        enabled: true,
      });
      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('rejects missing channel', async () => {
      const handler = postHandlers.find((h) => h.path === '/configs')?.handler;
      // Mock admin repo to allow this user
      mockFastify.repositories.admin.isAdmin.mockResolvedValue(true);
      await expect(
        handler({ body: { target: 'https://example.com' }, user: { sub: 'user-1', email: 'user@test.com' } }, {})
      ).rejects.toThrow();
    });

    it('returns 403 for non-admin users', async () => {
      const handler = postHandlers.find((h) => h.path === '/configs')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

      mockFastify.repositories.admin.isAdmin.mockResolvedValue(false);

      await handler(
        { body: { channel: 'email', target: 'ops@test.com', enabled: true }, user: { sub: 'user-2', email: 'nonadmin@test.com' } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Forbidden — admin required', code: 'FORBIDDEN' });
      expect(mockFastify.repositories.failover.insertConfig).not.toHaveBeenCalled();
    });

    it('allows god admins to bypass admin check', async () => {
      const handler = postHandlers.find((h) => h.path === '/configs')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

      mockFastify.repositories.admin.isAdmin.mockResolvedValue(false);

      await handler(
        { body: { channel: 'email', target: 'ops@test.com', enabled: true }, user: { sub: 'god-1', email: GOD_ADMIN_EMAIL } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockFastify.repositories.failover.insertConfig).toHaveBeenCalled();
      // isAdmin should NOT be called for god admins (they bypass DB check)
      expect(mockFastify.repositories.admin.isAdmin).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /configs/:id', () => {
    it('toggles config enabled state', async () => {
      const handler = patchHandlers.find((h) => h.path === '/configs/:id')?.handler;

      mockFastify.repositories.admin.isAdmin.mockResolvedValue(true);

      const result = await handler(
        { params: { id: '1' }, body: { enabled: false }, user: { sub: 'user-1', email: 'user@test.com' } },
        {}
      );

      expect(mockFastify.repositories.failover.toggleConfig).toHaveBeenCalledWith('1', false);
      expect(result).toEqual({ id: '1', enabled: false });
    });

    it('returns 403 for non-admin users', async () => {
      const handler = patchHandlers.find((h) => h.path === '/configs/:id')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

      mockFastify.repositories.admin.isAdmin.mockResolvedValue(false);

      await handler(
        { params: { id: '1' }, body: { enabled: false }, user: { sub: 'user-2', email: 'nonadmin@test.com' } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Forbidden — admin required', code: 'FORBIDDEN' });
      expect(mockFastify.repositories.failover.toggleConfig).not.toHaveBeenCalled();
    });

    it('allows god admins to bypass admin check', async () => {
      const handler = patchHandlers.find((h) => h.path === '/configs/:id')?.handler;

      mockFastify.repositories.admin.isAdmin.mockResolvedValue(false);

      const result = await handler(
        { params: { id: '1' }, body: { enabled: false }, user: { sub: 'god-1', email: GOD_ADMIN_EMAIL } },
        {}
      );

      expect(mockFastify.repositories.failover.toggleConfig).toHaveBeenCalledWith('1', false);
      expect(result).toEqual({ id: '1', enabled: false });
    });
  });

  describe('DELETE /configs/:id', () => {
    it('deletes a config', async () => {
      const handler = deleteHandlers.find((h) => h.path === '/configs/:id')?.handler;

      mockFastify.repositories.admin.isAdmin.mockResolvedValue(true);

      const result = await handler(
        { params: { id: '1' }, user: { sub: 'user-1', email: 'user@test.com' } },
        {}
      );

      expect(mockFastify.repositories.failover.deleteConfig).toHaveBeenCalledWith('1');
      expect(result.deleted).toBe(true);
    });

    it('returns 403 for non-admin users', async () => {
      const handler = deleteHandlers.find((h) => h.path === '/configs/:id')?.handler;
      const mockReply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

      mockFastify.repositories.admin.isAdmin.mockResolvedValue(false);

      await handler(
        { params: { id: '1' }, user: { sub: 'user-2', email: 'nonadmin@test.com' } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Forbidden — admin required', code: 'FORBIDDEN' });
      expect(mockFastify.repositories.failover.deleteConfig).not.toHaveBeenCalled();
    });

    it('allows god admins to bypass admin check', async () => {
      const handler = deleteHandlers.find((h) => h.path === '/configs/:id')?.handler;

      mockFastify.repositories.admin.isAdmin.mockResolvedValue(false);

      const result = await handler(
        { params: { id: '1' }, user: { sub: 'god-1', email: GOD_ADMIN_EMAIL } },
        {}
      );

      expect(mockFastify.repositories.failover.deleteConfig).toHaveBeenCalledWith('1');
      expect(result.deleted).toBe(true);
    });
  });
});
