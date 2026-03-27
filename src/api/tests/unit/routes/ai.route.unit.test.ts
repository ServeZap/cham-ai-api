import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiRoutes } from '../../../src/routes/ai.js';

// Mock openai dynamic import
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'AI response placeholder' } }],
          usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        }),
      },
    };
  },
}));

describe('AI Routes', () => {
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
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('POST /complete', () => {
    it('should complete text with AI', async () => {
      await aiRoutes(mockFastify);

      const completeHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/complete')[1];

      const requestData = {
        prompt: 'Hello, how are you?',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        context: { user_id: '123' },
      };

      const result = await completeHandler({ body: requestData }, mockReply);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.usage).toBeDefined();
    });

    it('should accept minimal required data', async () => {
      await aiRoutes(mockFastify);

      const completeHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/complete')[1];

      const requestData = {
        prompt: 'Test prompt',
      };

      const result = await completeHandler({ body: requestData }, mockReply);

      expect(result).toBeDefined();
      expect(result.usage).toBeDefined();
    });

    it('should reject empty prompt', async () => {
      await aiRoutes(mockFastify);

      const completeHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/complete')[1];

      const invalidData = {
        prompt: '',
      };

      await expect(completeHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });

    it('should accept optional session_id', async () => {
      await aiRoutes(mockFastify);

      const completeHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/complete')[1];

      const requestData = {
        prompt: 'Test with session',
        session_id: '550e8400-e29b-41d4-a716-446655440001',
      };

      const result = await completeHandler({ body: requestData }, mockReply);

      expect(result).toBeDefined();
    });

    it('should accept optional context', async () => {
      await aiRoutes(mockFastify);

      const completeHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/complete')[1];

      const requestData = {
        prompt: 'Test with context',
        context: { key: 'value', nested: { data: 123 } },
      };

      const result = await completeHandler({ body: requestData }, mockReply);

      expect(result).toBeDefined();
    });

    it('should reject invalid session_id format', async () => {
      await aiRoutes(mockFastify);

      const completeHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/complete')[1];

      const invalidData = {
        prompt: 'Test',
        session_id: 'invalid-uuid',
      };

      await expect(completeHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });
  });

  describe('POST /tools', () => {
    it('should execute AI tool', async () => {
      await aiRoutes(mockFastify);

      const toolsHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/tools')[1];

      const requestData = {
        tool: 'search_knowledge_base',
        parameters: { query: 'test query' },
      };

      const result = await toolsHandler({ body: requestData }, mockReply);

      expect(result.tool).toBe('search_knowledge_base');
      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should accept tool with parameters', async () => {
      await aiRoutes(mockFastify);

      const toolsHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/tools')[1];

      const requestData = {
        tool: 'get_user_info',
        parameters: { user_id: '123', include_history: true },
      };

      const result = await toolsHandler({ body: requestData }, mockReply);

      expect(result.tool).toBe('get_user_info');
      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should reject empty tool name', async () => {
      await aiRoutes(mockFastify);

      const toolsHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/tools')[1];

      const invalidData = {
        tool: '',
        parameters: {},
      };

      await expect(toolsHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });

    it('should reject missing tool name', async () => {
      await aiRoutes(mockFastify);

      const toolsHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/tools')[1];

      const invalidData = {
        parameters: {},
      };

      await expect(toolsHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });
  });

  describe('GET /prompts', () => {
    it('should list available prompts', async () => {
      await aiRoutes(mockFastify);

      const promptsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/prompts')[1];

      const result = await promptsHandler({}, mockReply);

      expect(result.prompts).toHaveLength(3);
      expect(result.prompts.map((p: any) => p.id)).toEqual([
        'customer-support',
        'appointment-scheduler',
        'sales-qualifier',
      ]);
    });

    it('should return prompts array', async () => {
      await aiRoutes(mockFastify);

      const promptsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/prompts')[1];

      const result = await promptsHandler({}, mockReply);

      expect(Array.isArray(result.prompts)).toBe(true);
      expect(result.prompts.length).toBe(3);
    });

    it('should return prompts with required fields', async () => {
      await aiRoutes(mockFastify);

      const promptsHandler = mockFastify.get.mock.calls.find((call: any[]) => call[0] === '/prompts')[1];

      const result = await promptsHandler({}, mockReply);

      result.prompts.forEach((prompt: any) => {
        expect(prompt).toHaveProperty('id');
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
      });
    });
  });
});
