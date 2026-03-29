import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usageRoutes } from '../../../src/routes/usage.js';

describe('Usage Routes', () => {
  let mockFastify: any;
  let mockReply: any;
  const GOD_ADMIN_EMAIL = 'hector.eng@gmail.com';

  beforeEach(async () => {
    process.env.ADMIN_EMAILS = GOD_ADMIN_EMAIL;

    mockFastify = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
      db: {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('GET /summary', () => {
    it('should return 403 when no tenant_id', async () => {
      await usageRoutes(mockFastify);

      const summaryHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/summary'
      )[1];

      await summaryHandler({ query: {}, user: { sub: 'user-1' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Tenant ID not found in token',
        code: 'TENANT_NOT_FOUND',
      });
    });

    it('should allow god admins without tenant_id', async () => {
      mockFastify.db.query = vi.fn().mockResolvedValue({ rows: [] });
      await usageRoutes(mockFastify);

      const summaryHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/summary'
      )[1];

      const result = await summaryHandler(
        { query: { granularity: 'day' }, user: { email: GOD_ADMIN_EMAIL } },
        mockReply
      );

      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
      expect(result.granularity).toBe('day');
    });

    it('should query usage with day granularity', async () => {
      mockFastify.db.query = vi.fn().mockResolvedValue({
        rows: [{
          period: '2026-03-29',
          total_events: '10',
          total_tokens: '5000',
          total_seconds: '300',
          total_cost: '0.50',
          stt_calls: '5',
          llm_calls: '8',
          tts_calls: '8',
        }],
      });

      await usageRoutes(mockFastify);

      const summaryHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/summary'
      )[1];

      const result = await summaryHandler(
        { query: { granularity: 'day' }, user: { app_metadata: { tenant_id: 'tenant-1' } } },
        mockReply
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].total_events).toBe(10);
      expect(result.data[0].total_tokens).toBe(5000);
      expect(result.data[0].total_minutes).toBe(5);
      expect(result.data[0].total_cost).toBe(0.50);
    });

    it('should query usage with hour granularity', async () => {
      mockFastify.db.query = vi.fn().mockResolvedValue({ rows: [] });
      await usageRoutes(mockFastify);

      const summaryHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/summary'
      )[1];

      await summaryHandler(
        { query: { granularity: 'hour' }, user: { app_metadata: { tenant_id: 'tenant-1' } } },
        mockReply
      );

      expect(mockFastify.db.query).toHaveBeenCalledWith(
        expect.stringContaining("DATE_TRUNC('hour'"),
        expect.any(Array)
      );
    });
  });

  describe('GET /limits', () => {
    it('should return 403 when no tenant_id', async () => {
      await usageRoutes(mockFastify);

      const limitsHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/limits'
      )[1];

      await limitsHandler({ query: {}, user: { sub: 'user-1' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });

    it('should return default limits when no DB record', async () => {
      mockFastify.db.query = vi.fn()
        .mockResolvedValueOnce({ rows: [] }) // limits
        .mockResolvedValueOnce({ rows: [{ current_minutes: '0', current_tokens: '0', current_cost: '0' }] }); // usage

      await usageRoutes(mockFastify);

      const limitsHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/limits'
      )[1];

      const result = await limitsHandler(
        { query: {}, user: { app_metadata: { tenant_id: 'tenant-1' } } },
        mockReply
      );

      expect(result.max_minutes).toBe(60);
      expect(result.max_tokens).toBe(100000);
      expect(result.max_cost).toBe(10.00);
      expect(result.current_minutes).toBe(0);
      expect(result.utilization_percent.minutes).toBe(0);
    });

    it('should return actual limits and usage', async () => {
      mockFastify.db.query = vi.fn()
        .mockResolvedValueOnce({ rows: [{
          max_minutes_per_day: 120,
          max_tokens_per_day: 200000,
          max_cost_per_day: 25.00,
          max_concurrent_calls: 10,
          currency: 'USD',
        }] })
        .mockResolvedValueOnce({ rows: [{ current_minutes: '45', current_tokens: '80000', current_cost: '8.50' }] });

      await usageRoutes(mockFastify);

      const limitsHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/limits'
      )[1];

      const result = await limitsHandler(
        { query: {}, user: { app_metadata: { tenant_id: 'tenant-2' } } },
        mockReply
      );

      expect(result.max_minutes).toBe(120);
      expect(result.current_minutes).toBe(45);
      expect(result.utilization_percent.minutes).toBe(38);
      expect(result.utilization_percent.cost).toBe(34);
    });
  });

  describe('PUT /limits', () => {
    it('should upsert tenant limits', async () => {
      mockFastify.db.query = vi.fn().mockResolvedValue({
        rows: [{
          tenant_id: 'tenant-1',
          max_minutes_per_day: 200,
          max_tokens_per_day: 500000,
          max_cost_per_day: 50.00,
          max_concurrent_calls: 10,
          currency: 'USD',
        }],
      });

      await usageRoutes(mockFastify);

      const updateHandler = mockFastify.put.mock.calls.find(
        (call: any[]) => call[0] === '/limits'
      )[1];

      const result = await updateHandler({
        body: { max_minutes_per_day: 200, max_tokens_per_day: 500000, max_cost_per_day: 50 },
        user: { app_metadata: { tenant_id: 'tenant-1' } },
      }, mockReply);

      expect(result.max_minutes_per_day).toBe(200);
      expect(mockFastify.db.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });
  });

  describe('POST /check', () => {
    it('should return allowed=true in dev mode (no DB)', async () => {
      // Temporarily remove db
      const origDb = mockFastify.db;
      mockFastify.db = null;

      await usageRoutes(mockFastify);

      const checkHandler = mockFastify.post.mock.calls.find(
        (call: any[]) => call[0] === '/check'
      )[1];

      const result = await checkHandler(
        { body: { estimated_minutes: 10, estimated_tokens: 5000 }, user: { app_metadata: { tenant_id: 't1' } } },
        mockReply
      );

      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('dev_no_db');

      mockFastify.db = origDb;
    });

    it('should return allowed=true when within limits', async () => {
      mockFastify.db.query = vi.fn().mockResolvedValue({
        rows: [{
          allowed: true,
          reason: null,
          current_minutes: '10',
          max_minutes: 60,
          current_tokens: '5000',
          max_tokens: 100000,
          current_cost: '0.50',
          max_cost: '10.00',
        }],
      });

      await usageRoutes(mockFastify);

      const checkHandler = mockFastify.post.mock.calls.find(
        (call: any[]) => call[0] === '/check'
      )[1];

      const result = await checkHandler(
        { body: { estimated_minutes: 5, estimated_tokens: 1000, estimated_cost: 0.25 }, user: { app_metadata: { tenant_id: 't1' } } },
        mockReply
      );

      expect(result.allowed).toBe(true);
      expect(result.current_minutes).toBe(10);
    });
  });

  describe('GET /calls/:callId', () => {
    it('should return 403 when no tenant_id', async () => {
      await usageRoutes(mockFastify);

      const callUsageHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/calls/:callId'
      )[1];

      await callUsageHandler({ params: { callId: 'call-123' }, user: { sub: 'user-1' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 when no usage found for call', async () => {
      mockFastify.db.query = vi.fn().mockResolvedValue({ rows: [] });

      await usageRoutes(mockFastify);

      const callUsageHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/calls/:callId'
      )[1];

      await callUsageHandler(
        { params: { callId: 'call-999' }, user: { app_metadata: { tenant_id: 't1' } } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Usage not found for this call',
        code: 'USAGE_NOT_FOUND',
      });
    });

    it('should return call usage breakdown', async () => {
      mockFastify.db.query = vi.fn().mockResolvedValue({
        rows: [{
          id: 'usage-1',
          tenant_id: 't1',
          call_id: 'call-123',
          llm_provider: 'openclaw',
          llm_total_tokens: 500,
          total_cost: '0.0025',
        }],
      });

      await usageRoutes(mockFastify);

      const callUsageHandler = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/calls/:callId'
      )[1];

      const result = await callUsageHandler(
        { params: { callId: 'call-123' }, user: { app_metadata: { tenant_id: 't1' } } },
        mockReply
      );

      expect(result.call_id).toBe('call-123');
      expect(result.total_cost).toBe('0.0025');
    });
  });
});
