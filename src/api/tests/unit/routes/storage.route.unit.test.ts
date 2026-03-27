import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageRoutes } from '../../../src/routes/storage.js';

// Mock global fetch for Supabase Storage REST API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Storage Routes', () => {
  let mockFastify: any;
  let mockReply: any;
  let postHandlers: any[];

  beforeEach(async () => {
    postHandlers = [];
    mockFastify = {
      post: vi.fn((path, handler) => {
        postHandlers.push({ path, handler });
      }),
    };
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    mockFetch.mockReset();

    // Set env vars for storage
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    await storageRoutes(mockFastify);
  });

  // ── POST /signed-url ───────────────────────────────────────────

  describe('POST /signed-url', () => {
    let handler: any;

    beforeEach(() => {
      handler = postHandlers.find((h) => h.path === '/signed-url')?.handler;
    });

    it('returns signed URL on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ signed_url: 'https://storage.supabase.co/sign/abc?token=xyz' }),
      });

      const result = await handler(
        {
          body: { path: 'tenant-1/calls/c1/audio.webm', expiresIn: 3600 },
          user: { app_metadata: { tenant_id: 'tenant-1' } },
          log: { error: vi.fn() },
        },
        mockReply
      );

      expect(result.signedUrl).toBe('https://storage.supabase.co/sign/abc?token=xyz');
      expect(result.path).toBe('tenant-1/calls/c1/audio.webm');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('rejects empty path', async () => {
      await expect(
        handler(
          { body: { path: '' }, user: { app_metadata: { tenant_id: 't1' } }, log: { error: vi.fn() } },
          mockReply
        )
      ).rejects.toThrow('Path é obrigatório');
    });

    it('rejects missing tenant_id', async () => {
      const result = await handler(
        { body: { path: 't1/audio.wav' }, user: {}, log: { error: vi.fn() } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'TENANT_NOT_FOUND' })
      );
    });

    it('rejects path that does not belong to tenant', async () => {
      const result = await handler(
        { body: { path: 'other-tenant/audio.wav' }, user: { app_metadata: { tenant_id: 't1' } }, log: { error: vi.fn() } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN' })
      );
    });

    it('strips leading slashes from path', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ signed_url: 'https://signed' }),
      });

      await handler(
        { body: { path: '/t1/audio.wav' }, user: { app_metadata: { tenant_id: 't1' } }, log: { error: vi.fn() } },
        mockReply
      );

      // Verify fetch was called with normalized path (no leading slash)
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.path).toBe('t1/audio.wav');
    });

    it('returns STORAGE_ERROR when Supabase API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal error' }),
      });

      const result = await handler(
        { body: { path: 't1/audio.wav' }, user: { app_metadata: { tenant_id: 't1' } }, log: { error: vi.fn() } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'STORAGE_ERROR' })
      );
    });

    it('returns STORAGE_ERROR when SUPABASE_URL not configured', async () => {
      delete process.env.SUPABASE_URL;

      const result = await handler(
        { body: { path: 't1/audio.wav' }, user: { app_metadata: { tenant_id: 't1' } }, log: { error: vi.fn() } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(500);
    });
  });

  // ── POST /signed-urls (batch) ──────────────────────────────────

  describe('POST /signed-urls', () => {
    let handler: any;

    beforeEach(() => {
      handler = postHandlers.find((h) => h.path === '/signed-urls')?.handler;
    });

    it('returns signed URLs for multiple paths', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ signed_url: 'https://a' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ signed_url: 'https://b' }) });

      const result = await handler(
        {
          body: { paths: ['t1/a.wav', 't1/b.wav'], expiresIn: 3600 },
          user: { app_metadata: { tenant_id: 't1' } },
          log: { error: vi.fn() },
        },
        mockReply
      );

      expect(result.signedUrls).toHaveLength(2);
      expect(result.signedUrls[0].signedUrl).toBe('https://a');
      expect(result.signedUrls[1].signedUrl).toBe('https://b');
    });

    it('rejects paths not belonging to tenant', async () => {
      await handler(
        {
          body: { paths: ['t1/a.wav', 'other/b.wav'] },
          user: { app_metadata: { tenant_id: 't1' } },
          log: { error: vi.fn() },
        },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FORBIDDEN' })
      );
    });

    it('rejects empty paths array', async () => {
      await expect(
        handler(
          {
            body: { paths: [] },
            user: { app_metadata: { tenant_id: 't1' } },
            log: { error: vi.fn() },
          },
          mockReply
        )
      ).rejects.toThrow('Paths é obrigatório');
    });

    it('handles partial failures gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ signed_url: 'https://ok' }) })
        .mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Not found' }) });

      const result = await handler(
        {
          body: { paths: ['t1/exists.wav', 't1/missing.wav'] },
          user: { app_metadata: { tenant_id: 't1' } },
          log: { error: vi.fn() },
        },
        mockReply
      );

      expect(result.signedUrls).toHaveLength(2);
      expect(result.signedUrls[0].signedUrl).toBe('https://ok');
      expect(result.signedUrls[1].signedUrl).toBeNull();
    });
  });
});
