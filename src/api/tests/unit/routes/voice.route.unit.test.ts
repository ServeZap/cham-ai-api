import { describe, it, expect, beforeEach, vi } from 'vitest';
import { voiceRoutes } from '../../../src/routes/voice.js';

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
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      },
    };
    audio = {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'Mock transcription',
        }),
      },
    };
  },
}));

describe('Voice Routes', () => {
  let mockFastify: any;
  let mockReply: any;
  let mockWebSocketConnection: any;
  let mockSocket: any;
  let mockRegisterFastify: any;

  beforeEach(async () => {
    mockSocket = {
      on: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    mockWebSocketConnection = {
      socket: mockSocket,
    };

    mockRegisterFastify = {
      get: vi.fn().mockReturnThis(),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    mockFastify = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      register: vi.fn().mockImplementation(async (handler: any) => {
        await handler(mockRegisterFastify);
      }),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('POST /converse', () => {
    it('should create a conversation with required fields', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const requestData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
        text: 'Hello!',
      };

      const result = await converseHandler({ body: requestData }, mockReply);

      expect(result).toBeDefined();
      expect(result.conversation_id).toBeDefined();
      expect(result.session_id).toBeDefined();
      expect(result.response_text).toBeDefined();
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('should create a new session_id when not provided', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const requestData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
        audio: 'base64encodedaudio',
      };

      const result = await converseHandler({ body: requestData }, mockReply);

      expect(result.session_id).toBeDefined();
    });

    it('should use provided session_id', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const requestData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440001',
        session_id: '550e8400-e29b-41d4-a716-446655440001',
        text: 'Hello again!',
      };

      const result = await converseHandler({ body: requestData }, mockReply);

      expect(result.session_id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should validate assistant_id is required', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const invalidData = {
        text: 'Hello!',
      };

      await expect(converseHandler({ body: invalidData }, mockReply)).rejects.toThrow();
    });

    it('should accept audio input', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const requestData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
        audio: 'base64encodedaudio',
      };

      const result = await converseHandler({ body: requestData }, mockReply);

      expect(result).toBeDefined();
    });

    it('should accept text input', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const requestData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
        text: 'Hello, how are you?',
      };

      const result = await converseHandler({ body: requestData }, mockReply);

      expect(result).toBeDefined();
    });

    it('should return response_text', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const requestData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
        text: 'What is the weather?',
      };

      const result = await converseHandler({ body: requestData }, mockReply);

      expect(result.response_text).toBeDefined();
      expect(typeof result.response_text).toBe('string');
    });

    it('should return latency_ms', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const requestData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
        text: 'Quick question',
      };

      const result = await converseHandler({ body: requestData }, mockReply);

      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
      expect(typeof result.latency_ms).toBe('number');
    });

    it('should return null response_audio when not applicable', async () => {
      await voiceRoutes(mockFastify);

      const converseHandler = mockFastify.post.mock.calls.find((call: any[]) => call[0] === '/converse')[1];

      const requestData = {
        assistant_id: '550e8400-e29b-41d4-a716-446655440000',
        text: 'Text only input',
      };

      const result = await converseHandler({ body: requestData }, mockReply);

      expect(result.response_audio).toBeNull();
    });
  });

  describe('WebSocket /stream/:id', () => {
    it('should register WebSocket handler', async () => {
      await voiceRoutes(mockFastify);

      expect(mockFastify.register).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should register handler for /stream/:id route', async () => {
      await voiceRoutes(mockFastify);

      expect(mockRegisterFastify.get).toHaveBeenCalledWith(
        '/stream/:id',
        { websocket: true },
        expect.any(Function)
      );
    });

    it('should extract id from params on connection', async () => {
      await voiceRoutes(mockFastify);

      const wsHandler = mockRegisterFastify.get.mock.calls.find((call: any[]) => call[0] === '/stream/:id')[2];

      const mockReq = { params: { id: 'stream-123' } };

      wsHandler(mockWebSocketConnection, mockReq);

      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should handle incoming messages', async () => {
      await voiceRoutes(mockFastify);

      const wsHandler = mockRegisterFastify.get.mock.calls.find((call: any[]) => call[0] === '/stream/:id')[2];

      const mockReq = { params: { id: 'stream-456' } };

      wsHandler(mockWebSocketConnection, mockReq);

      const messageHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

      const mockMessage = { type: 'audio', data: 'base64audio' };

      await messageHandler(mockMessage);

      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'response',
          text: 'Echo: ' + mockMessage,
        })
      );
    });

    it('should send response with echo for messages', async () => {
      await voiceRoutes(mockFastify);

      const wsHandler = mockRegisterFastify.get.mock.calls.find((call: any[]) => call[0] === '/stream/:id')[2];

      const mockReq = { params: { id: 'stream-789' } };

      wsHandler(mockWebSocketConnection, mockReq);

      const messageHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'message')[1];

      await messageHandler('test message');

      const sentData = mockSocket.send.mock.calls[0][0];
      const parsed = JSON.parse(sentData);
      expect(parsed.type).toBe('response');
      expect(parsed.text).toContain('test message');
    });
  });
});
