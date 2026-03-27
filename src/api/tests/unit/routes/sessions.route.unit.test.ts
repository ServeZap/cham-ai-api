import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionsRoutes } from '../../../src/routes/sessions.js';

// Mock crypto.randomUUID at the top level
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
}));

describe('Sessions Routes', () => {
  let mockFastify: any;
  let mockReply: any;

  beforeEach(async () => {
    mockFastify = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      // Add repositories mock
      repositories: {
        sessions: {
          findAll: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
          findById: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async (data: any) => ({
            id: '123e4567-e89b-12d3-a456-426614174000',
            ...data,
            status: 'active',
            context: {},
            metadata: data.metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
          update: vi.fn().mockResolvedValue(null),
          delete: vi.fn().mockResolvedValue(false),
        },
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('GET / (list sessions)', () => {
    it('should return empty sessions list with default pagination', async () => {
      await sessionsRoutes(mockFastify);

      const listHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const result = await listHandler({ query: {} }, mockReply);

      expect(result).toEqual({
        sessions: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
        },
      });
    });

    it('should parse pagination parameters', async () => {
      await sessionsRoutes(mockFastify);

      const listHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const result = await listHandler({ query: { page: 2, limit: 10 } }, mockReply);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
    });

    it('should parse tenant_id filter', async () => {
      await sessionsRoutes(mockFastify);

      const listHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const result = await listHandler({ query: { tenant_id: 'tenant-123' } }, mockReply);

      expect(result).toBeDefined();
      expect(result.sessions).toEqual([]);
    });

    it('should parse assistant_id filter', async () => {
      await sessionsRoutes(mockFastify);

      const listHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const result = await listHandler({ query: { assistant_id: '550e8400-e29b-41d4-a716-446655440000' } }, mockReply);

      expect(result).toBeDefined();
    });
  });

  describe('POST / (create session)', () => {
    it('should create a new session with valid data', async () => {
      await sessionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const sessionData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      await createHandler({ body: sessionData }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          assistant_id: sessionData.assistant_id,
          status: 'active',
        })
      );
    });

    it('should set created_at and updated_at timestamps', async () => {
      await sessionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const sessionData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440002',
      };

      await createHandler({ body: sessionData }, mockReply);

      const sentSession = mockReply.send.mock.calls[0][0];
      expect(sentSession.created_at).toBeDefined();
      expect(sentSession.updated_at).toBeDefined();
    });

    it('should initialize empty context', async () => {
      await sessionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const sessionData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440004',
      };

      await createHandler({ body: sessionData }, mockReply);

      const sentSession = mockReply.send.mock.calls[0][0];
      expect(sentSession.context).toEqual({});
    });

    it('should accept optional metadata', async () => {
      await sessionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const sessionData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440006',
        metadata: { source: 'web', campaign: 'promo' },
      };

      await createHandler({ body: sessionData }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('should reject invalid assistant_id format', async () => {
      await sessionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const invalidData = {
        assistant_id: 'invalid-uuid',
        tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      await expect(createHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });

    it('should reject invalid assistant_id format', async () => {
      await sessionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const invalidData = {
        assistant_id: 'not-a-uuid',
      };

      await expect(createHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });

    it('should accept body with only metadata', async () => {
      await sessionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const validData = {
        metadata: { source: 'api' },
      };

      // assistant_id is optional, so this should succeed
      const result = await createHandler({ body: validData }, mockReply);
      expect(mockReply.status).toHaveBeenCalledWith(201);
    });
  });

  describe('GET /:id (get session by ID)', () => {
    it('should return 404 for non-existent session', async () => {
      await sessionsRoutes(mockFastify);

      const getHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      await getHandler({ params: { id: 'non-existent' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    });

    it('should extract id from params', async () => {
      await sessionsRoutes(mockFastify);

      const getHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      await getHandler({ params: { id: 'session-123' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('PUT /:id (update session)', () => {
    it('should return 404 for non-existent session', async () => {
      await sessionsRoutes(mockFastify);

      const updateHandler = mockFastify.put.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      await updateHandler({ params: { id: 'non-existent' }, body: {} }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    });

    it('should parse update data', async () => {
      await sessionsRoutes(mockFastify);

      const updateHandler = mockFastify.put.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      const updateData = {
        context: { last_message: 'test' },
        metadata: { updated: true },
      };

      await updateHandler({ params: { id: 'test-id' }, body: updateData }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /:id (delete session)', () => {
    it('should return 204 for deletion', async () => {
      await sessionsRoutes(mockFastify);

      const deleteHandler = mockFastify.delete.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      // Override mock to return true for this test
      (mockFastify as any).repositories.sessions.delete = vi.fn().mockResolvedValue(true);

      await deleteHandler({ params: { id: 'session-id' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(204);
      expect(mockReply.send).toHaveBeenCalledWith();
    });
  });
});
