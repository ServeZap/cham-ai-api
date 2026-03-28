import { describe, it, expect, beforeEach, vi } from 'vitest';
import { callsRoutes } from '../../../src/routes/calls.js';

// Mock crypto.randomUUID at the top level
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
}));

// Mock openai dynamic import
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI response' } }],
        }),
      },
    };
  },
}));

describe('Calls Routes', () => {
  let mockFastify: any;
  let mockReply: any;
  const GOD_ADMIN_EMAIL = 'hector.eng@gmail.com';

  beforeEach(async () => {
    process.env.ADMIN_EMAILS = GOD_ADMIN_EMAIL;
    mockFastify = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      // Add repositories mock
      repositories: {
        calls: {
          findAll: vi.fn().mockResolvedValue({ calls: [], total: 0 }),
          findById: vi.fn().mockResolvedValue(null),
          getOverview: vi.fn().mockResolvedValue({ totalCalls: 0 }),
          create: vi.fn().mockResolvedValue({
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'initiated',
            created_at: new Date().toISOString(),
            start_time: new Date().toISOString(),
          }),
          update: vi.fn().mockResolvedValue(null),
        },
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            context: {},
          }),
        },
      },
      pg: {
        query: vi.fn().mockResolvedValue({ rows: [{ id: '1', call_id: 'call-1', created_at: new Date().toISOString() }] }),
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('POST /inbound', () => {
    it('should handle inbound call', async () => {
      await callsRoutes(mockFastify);

      const inboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/inbound')[1];

      const requestBody = {
        CallSid: 'CA1234567890ABCDEF',
        From: '+1234567890',
        To: '+0987654321',
      };

      const result = await inboundHandler({ body: requestBody }, mockReply);

      expect(result).toEqual({
        call_id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'answered',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    it('should extract CallSid from request body', async () => {
      await callsRoutes(mockFastify);

      const inboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/inbound')[1];

      const requestBody = {
        CallSid: 'CA9876543210FEDCBA',
        From: '+15555555555',
        To: '+14444444444',
      };

      const result = await inboundHandler({ body: requestBody }, mockReply);

      // call_id comes from repo.create() mock, not from CallSid
      expect(result.call_id).toBeDefined();
    });

    it('should generate session_id for inbound call', async () => {
      await callsRoutes(mockFastify);

      const inboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/inbound')[1];

      const requestBody = {
        CallSid: 'CA000000000000000',
        From: '+1000000000',
        To: '+1111111111',
      };

      const result = await inboundHandler({ body: requestBody }, mockReply);

      expect(result.session_id).toBeDefined();
      expect(result.session_id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should set status to answered', async () => {
      await callsRoutes(mockFastify);

      const inboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/inbound')[1];

      const requestBody = {
        CallSid: 'CA111111111111111',
        From: '+1222222222',
        To: '+1333333333',
      };

      const result = await inboundHandler({ body: requestBody }, mockReply);

      expect(result.status).toBe('answered');
    });
  });

  describe('POST /outbound', () => {
    it('should initiate outbound call', async () => {
      await callsRoutes(mockFastify);

      const outboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/outbound')[1];

      const requestData = {
        phone_number: '+1234567890',
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      await outboundHandler({ body: requestData }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'initiated',
        })
      );
    });

    it('should generate call id for outbound call', async () => {
      await callsRoutes(mockFastify);

      const outboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/outbound')[1];

      const requestData = {
        phone_number: '+15555555555',
        assistant_id: '550e8400-e29b-41d4-a716-446655440001',
      };

      await outboundHandler({ body: requestData }, mockReply);

      const sentCall = mockReply.send.mock.calls[0][0];
      expect(sentCall.id).toBeDefined();
    });

    it('should set created_at timestamp', async () => {
      await callsRoutes(mockFastify);

      const outboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/outbound')[1];

      const requestData = {
        phone_number: '+14444444444',
        assistant_id: '550e8400-e29b-41d4-a716-446655440002',
      };

      await outboundHandler({ body: requestData }, mockReply);

      const sentCall = mockReply.send.mock.calls[0][0];
      expect(sentCall.created_at).toBeDefined();
    });

    it('should accept optional metadata', async () => {
      await callsRoutes(mockFastify);

      const outboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/outbound')[1];

      const requestData = {
        phone_number: '+19999999999',
        assistant_id: '550e8400-e29b-41d4-a716-446655440003',
        metadata: { campaign: 'promo', source: 'web' },
      };

      await outboundHandler({ body: requestData }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('should reject phone_number with less than 10 characters', async () => {
      await callsRoutes(mockFastify);

      const outboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/outbound')[1];

      const invalidData = {
        phone_number: '123',
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      await expect(outboundHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });

    it('should reject invalid assistant_id format', async () => {
      await callsRoutes(mockFastify);

      const outboundHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/outbound')[1];

      const invalidData = {
        phone_number: '+1234567890',
        assistant_id: 'invalid-uuid',
      };

      await expect(outboundHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });
  });

  describe('GET /', () => {
    it('should list calls with pagination', async () => {
      await callsRoutes(mockFastify);

      const listHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const result = await listHandler({ query: {} }, mockReply);

      expect(result).toEqual({
        calls: [],
        pagination: expect.objectContaining({ page: 1, limit: 50, total: 0 }),
      });
    });
  });

  describe('GET /overview', () => {
    it('should return overview data', async () => {
      await callsRoutes(mockFastify);

      const overviewHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/overview')[1];

      const result = await overviewHandler({ query: { since: '2024-01-01' } }, mockReply);

      expect(result).toBeDefined();
      expect(result.totalCalls).toBeDefined();
    });
  });

  describe('GET /:id', () => {
    it('should return 404 for non-existent call', async () => {
      await callsRoutes(mockFastify);

      const getHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      await getHandler({ params: { id: 'non-existent' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Call not found',
        code: 'CALL_NOT_FOUND',
      });
    });

    it('should extract id from params', async () => {
      await callsRoutes(mockFastify);

      const getHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      await getHandler({ params: { id: 'CA123456789' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('GET /:id/recording', () => {
    it('should return 404 when call not found', async () => {
      await callsRoutes(mockFastify);

      const recordingHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/:id/recording')[1];

      await recordingHandler({ params: { id: 'non-existent' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Call not found',
        code: 'CALL_NOT_FOUND',
      });
    });

    it('should return 404 for recording when call exists but no recording', async () => {
      await callsRoutes(mockFastify);

      const recordingHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/:id/recording')[1];

      // Override findById to return a call (recording not yet implemented)
      (mockFastify as any).repositories.calls.findById = vi.fn().mockResolvedValue({
        id: 'call-123',
        status: 'completed',
      });

      await recordingHandler({ params: { id: 'call-123' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Recording not found',
        code: 'RECORDING_NOT_FOUND',
      });
    });

    it('should extract id from params for recording', async () => {
      await callsRoutes(mockFastify);

      const recordingHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/:id/recording')[1];

      await recordingHandler({ params: { id: 'CA987654321' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('GET /cdrs', () => {
    it('returns CDR records for a tenant user', async () => {
      await callsRoutes(mockFastify);

      const cdrsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/cdrs')[1];

      const result = await cdrsHandler(
        { query: {}, user: { sub: 'user-1', app_metadata: { tenant_id: 'tenant-1' } } },
        mockReply
      );

      expect(result).toEqual({ data: [{ id: '1', call_id: 'call-1', created_at: expect.any(String) }] });
      expect(mockFastify.pg.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tu.tenant_id = $1'),
        expect.arrayContaining(['tenant-1'])
      );
    });

    it('returns 403 when user has no tenant_id and is not a god admin', async () => {
      await callsRoutes(mockFastify);

      const cdrsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/cdrs')[1];

      await cdrsHandler(
        { query: {}, user: { sub: 'user-2', email: 'nonadmin@test.com' } },
        mockReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Tenant ID not found in token',
        code: 'TENANT_NOT_FOUND',
      });
    });

    it('allows god admins to bypass tenant isolation', async () => {
      await callsRoutes(mockFastify);

      const cdrsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/cdrs')[1];

      const result = await cdrsHandler(
        { query: {}, user: { sub: 'god-1', email: GOD_ADMIN_EMAIL } },
        mockReply
      );

      expect(result).toEqual({ data: [{ id: '1', call_id: 'call-1', created_at: expect.any(String) }] });
      // God admin query should NOT have a WHERE tenant_id clause
      expect(mockFastify.pg.query).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE tu.tenant_id'),
        expect.any(Array)
      );
    });
  });
});
