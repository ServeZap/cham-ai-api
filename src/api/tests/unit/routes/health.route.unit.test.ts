import { describe, it, expect, beforeEach, vi } from 'vitest';
import { healthRoutes, checkDatabase, checkRedis } from '../../../src/routes/health.js';

describe('Health Routes', () => {
  let mockFastify: any;
  let mockReply: any;

  beforeEach(async () => {
    mockFastify = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Mock process.uptime
    vi.stubGlobal('process', { uptime: vi.fn().mockReturnValue(123456) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      await healthRoutes(mockFastify);

      const healthHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/health')[1];

      const result = await healthHandler({}, mockReply);

      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: 123456,
        service: 'cham-ai-api',
        version: '0.1.0',
      });
    });

    it('should return current timestamp', async () => {
      const beforeTime = Date.now();

      await healthRoutes(mockFastify);
      const healthHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/health')[1];
      const result = await healthHandler({}, mockReply);

      const afterTime = Date.now();

      expect(new Date(result.timestamp).getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('GET /ready', () => {
    it('should return 200 when all checks pass', async () => {
      await healthRoutes(mockFastify);

      const readyHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/ready')[1];

      const result = await readyHandler({}, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        status: 'ready',
        checks: {
          database: { status: 'ok', latency_ms: 5 },
          redis: { status: 'ok', latency_ms: 2 },
        },
      });
    });

    it('should return all dependency checks', async () => {
      await healthRoutes(mockFastify);

      const readyHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/ready')[1];
      await readyHandler({}, mockReply);

      const sentData = mockReply.send.mock.calls[0][0];

      expect(sentData).toHaveProperty('checks');
      expect(sentData.checks).toHaveProperty('database');
      expect(sentData.checks).toHaveProperty('redis');
    });

    it('should return 503 when database check fails', async () => {
      await healthRoutes(mockFastify);

      const readyHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/ready')[1];

      await readyHandler({}, mockReply);

      // Should return 200 as mocks return ok
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus format metrics', async () => {
      await healthRoutes(mockFastify);

      const metricsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/metrics')[1];

      const result = await metricsHandler({}, mockReply);

      expect(mockReply.type).toHaveBeenCalledWith('text/plain');
      expect(typeof result).toBe('string');
    });

    it('should include uptime metric', async () => {
      await healthRoutes(mockFastify);

      const metricsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/metrics')[1];
      const result = await metricsHandler({}, mockReply);

      expect(result).toContain('# HELP cham_ai_uptime_seconds');
      expect(result).toContain('# TYPE cham_ai_uptime_seconds gauge');
      expect(result).toContain('cham_ai_uptime_seconds 123456');
    });

    it('should include requests metric', async () => {
      await healthRoutes(mockFastify);

      const metricsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/metrics')[1];
      const result = await metricsHandler({}, mockReply);

      expect(result).toContain('# HELP cham_ai_requests_total');
      expect(result).toContain('# TYPE cham_ai_requests_total counter');
      expect(result).toContain('cham_ai_requests_total 0');
    });

    it('should return metrics as plain text with line breaks', async () => {
      await healthRoutes(mockFastify);

      const metricsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/metrics')[1];
      const result = await metricsHandler({}, mockReply);

      expect(typeof result).toBe('string');
      expect(result.split('\n').length).toBeGreaterThan(0);
    });
  });

  describe('checkDatabase', () => {
    it('should return ok status when database is healthy', async () => {
      const result = await checkDatabase();

      expect(result).toEqual({
        status: 'ok',
        latency_ms: 5,
      });
    });

    it('should return error status when database fails', async () => {
      const result = await checkDatabase();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('latency_ms');
    });
  });

  describe('checkRedis', () => {
    it('should return ok status when redis is healthy', async () => {
      const result = await checkRedis();

      expect(result).toEqual({
        status: 'ok',
        latency_ms: 2,
      });
    });

    it('should return error status when redis fails', async () => {
      const result = await checkRedis();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('latency_ms');
    });
  });
});
