import { describe, it, expect, beforeEach, vi } from 'vitest';
import { missionsRoutes } from '../../../src/routes/missions.js';

describe('Missions Routes', () => {
  let mockFastify: any;
  let mockReply: any;

  beforeEach(async () => {
    mockFastify = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
      repositories: {
        missions: {
          findAll: vi.fn().mockResolvedValue({ missions: [], total: 0 }),
          findById: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: '123e4567-e89b-12d3-a456-426614174000',
            mission_name: 'Test Mission',
            description: 'Test description',
            target_url: 'https://example.com',
            status: 'queued',
            steps: [],
            logs: [],
            progress: 0,
            created_at: new Date().toISOString(),
          }),
          update: vi.fn().mockResolvedValue(null),
          updateStatus: vi.fn().mockResolvedValue(null),
          delete: vi.fn().mockResolvedValue(false),
        },
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('POST /', () => {
    it('should create a mission with required fields', async () => {
      await missionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      await createHandler({
        body: {
          name: 'Test Mission',
          description: 'A test mission',
          target_url: 'https://example.com',
        },
      }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'queued',
          mission_name: 'Test Mission',
        })
      );
    });

    it('should reject missing name', async () => {
      await missionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      await expect(createHandler({
        body: {
          description: 'No name',
          target_url: 'https://example.com',
        },
      }, mockReply)).rejects.toThrow();
    });

    it('should reject invalid target_url', async () => {
      await missionsRoutes(mockFastify);

      const createHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/')[1];

      await expect(createHandler({
        body: {
          name: 'Bad URL',
          description: 'Test',
          target_url: 'not-a-url',
        },
      }, mockReply)).rejects.toThrow();
    });
  });

  describe('GET /', () => {
    it('should list missions with pagination', async () => {
      await missionsRoutes(mockFastify);

      const listHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/')[1];

      const result = await listHandler({ query: {} }, mockReply);

      expect(result).toEqual({
        missions: [],
        pagination: expect.objectContaining({ page: 1, limit: 50, total: 0 }),
      });
    });
  });

  describe('GET /:id', () => {
    it('should return 404 for non-existent mission', async () => {
      await missionsRoutes(mockFastify);

      const getHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      await getHandler({ params: { id: 'non-existent' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Mission not found',
        code: 'MISSION_NOT_FOUND',
      });
    });
  });

  describe('PUT /:id', () => {
    it('should return 404 when updating non-existent mission', async () => {
      await missionsRoutes(mockFastify);

      const updateHandler = mockFastify.put.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      await updateHandler({ params: { id: 'non-existent' }, body: { mission_name: 'Updated' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /:id', () => {
    it('should return 404 when deleting non-existent mission', async () => {
      await missionsRoutes(mockFastify);

      const deleteHandler = mockFastify.delete.mock.calls.find((call: any[]) => call[0] === '/:id')[1];

      await deleteHandler({ params: { id: 'non-existent' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /:id/pause', () => {
    it('should return 404 for non-existent mission', async () => {
      await missionsRoutes(mockFastify);

      const pauseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/:id/pause')[1];

      await pauseHandler({ params: { id: 'non-existent' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /:id/resume', () => {
    it('should return 404 for non-existent mission', async () => {
      await missionsRoutes(mockFastify);

      const resumeHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/:id/resume')[1];

      await resumeHandler({ params: { id: 'non-existent' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /:id/cancel', () => {
    it('should return 404 for non-existent mission', async () => {
      await missionsRoutes(mockFastify);

      const cancelHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/:id/cancel')[1];

      await cancelHandler({ params: { id: 'non-existent' } }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /:id/screenshot', () => {
    it('should return 404 for non-existent mission', async () => {
      await missionsRoutes(mockFastify);

      const screenshotHandler = mockFastify.post.mock.calls.find(
        (call: any[]) => call[0] === '/:id/screenshot'
      )[1];

      await screenshotHandler({ params: { id: 'non-existent' }, body: {} }, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Mission not found',
        code: 'MISSION_NOT_FOUND',
      });
    });

    it('should return provider "none" when no UI_EXECUTOR_URL configured', async () => {
      const originalUrl = process.env.UI_EXECUTOR_URL;
      delete process.env.UI_EXECUTOR_URL;

      await missionsRoutes(mockFastify);

      const screenshotHandler = mockFastify.post.mock.calls.find(
        (call: any[]) => call[0] === '/:id/screenshot'
      )[1];

      (mockFastify as any).repositories.missions.findById = vi.fn().mockResolvedValue({
        id: 'mission-123',
        status: 'running',
      });

      const result = await screenshotHandler({ params: { id: 'mission-123' }, body: {} }, mockReply);

      expect(result.mission_id).toBe('mission-123');
      expect(result.provider).toBe('none');
      expect(result.imageBase64).toBeNull();
      expect(result.message).toContain('UI_EXECUTOR_URL');

      if (originalUrl) process.env.UI_EXECUTOR_URL = originalUrl;
    });

    it('should delegate to UI executor when UI_EXECUTOR_URL is set', async () => {
      const originalUrl = process.env.UI_EXECUTOR_URL;
      process.env.UI_EXECUTOR_URL = 'http://localhost:9010';

      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ imageBase64: 'iVBORw0KGgoAAAANSUhEUg==' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await missionsRoutes(mockFastify);

      const screenshotHandler = mockFastify.post.mock.calls.find(
        (call: any[]) => call[0] === '/:id/screenshot'
      )[1];

      (mockFastify as any).repositories.missions.findById = vi.fn().mockResolvedValue({
        id: 'mission-456',
        status: 'running',
      });

      const result = await screenshotHandler(
        { params: { id: 'mission-456' }, body: { step_index: 2 } },
        mockReply
      );

      expect(result.mission_id).toBe('mission-456');
      expect(result.provider).toBe('ui-executor');
      expect(result.imageBase64).toBe('iVBORw0KGgoAAAANSUhEUg==');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9010/api/v1/screenshot',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mission_id: 'mission-456', step_index: 2 }),
        })
      );

      vi.unstubAllGlobals();
      if (originalUrl) process.env.UI_EXECUTOR_URL = originalUrl;
      else delete process.env.UI_EXECUTOR_URL;
    });

    it('should handle UI executor error gracefully', async () => {
      process.env.UI_EXECUTOR_URL = 'http://localhost:9010';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Browser not available' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await missionsRoutes(mockFastify);

      const screenshotHandler = mockFastify.post.mock.calls.find(
        (call: any[]) => call[0] === '/:id/screenshot'
      )[1];

      (mockFastify as any).repositories.missions.findById = vi.fn().mockResolvedValue({
        id: 'mission-789',
        status: 'running',
      });

      const result = await screenshotHandler(
        { params: { id: 'mission-789' }, body: {} },
        mockReply
      );

      expect(result.provider).toBe('ui-executor');
      expect(result.imageBase64).toBeNull();
      expect(result.error).toContain('500');

      vi.unstubAllGlobals();
      delete process.env.UI_EXECUTOR_URL;
    });
  });
});
