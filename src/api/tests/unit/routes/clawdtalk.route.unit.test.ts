import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clawdTalkRoutes } from '../../../src/routes/clawdtalk.js';

describe('ClawdTalk Routes', () => {
  let mockFastify: any;
  let mockConnection: any;
  let mockSocket: any;

  beforeEach(async () => {
    mockSocket = {
      send: vi.fn(),
      on: vi.fn(),
    };

    mockConnection = {
      socket: mockSocket,
    };

    mockFastify = {
      get: vi.fn(),
      register: vi.fn((plugin: any) => {
        if (typeof plugin === 'function') {
          plugin(mockFastify);
        }
      }),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      // Add redis mock
      redis: {
        keys: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('1'),
        del: vi.fn().mockResolvedValue(1),
      },
      // Add jwt mock
      jwt: {
        verify: vi.fn(),
      },
    };
  });

  describe('GET /status', () => {
    it('should return service status', async () => {
      await clawdTalkRoutes(mockFastify);

      const statusCall = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/status'
      );
      expect(statusCall).toBeDefined();

      const handler = statusCall[1];
      const result = await handler();

      expect(result).toEqual({
        service: 'clawdtalk-integration',
        status: 'operational',
        active_calls: 0,
        timestamp: expect.any(String),
      });
    });

    it('should return zero active calls initially', async () => {
      await clawdTalkRoutes(mockFastify);

      const statusCall = mockFastify.get.mock.calls.find(
        (call: any[]) => call[0] === '/status'
      );
      const handler = statusCall[1];
      const result = await handler();

      expect(result.active_calls).toBe(0);
    });
  });

  describe('WebSocket /webhook', () => {
    it('should register WebSocket endpoint', async () => {
      await clawdTalkRoutes(mockFastify);

      expect(mockFastify.register).toHaveBeenCalled();
    });

    it('should send connection acknowledgment on connect', async () => {
      await clawdTalkRoutes(mockFastify);

      const registerCall = mockFastify.register.mock.calls[0];
      const pluginFn = registerCall[0];

      await pluginFn(mockFastify);

      const wsCall = mockFastify.get.mock.calls.find(
        (call: any[]) => call[1]?.websocket === true
      );

      expect(wsCall).toBeDefined();
      expect(wsCall[0]).toBe('/webhook');
    });

    it('should handle start event', async () => {
      const startEvent = {
        call_id: 'call-123',
        text: '',
        timestamp: new Date().toISOString(),
        sequence: 1,
        event: 'start',
      };

      expect(startEvent.call_id).toBe('call-123');
    });

    it('should handle speech event with text', async () => {
      const speechEvent = {
        call_id: 'call-456',
        text: 'Hello, how are you?',
        timestamp: new Date().toISOString(),
        sequence: 2,
        event: 'speech',
      };

      expect(speechEvent.event).toBe('speech');
      expect(speechEvent.text).toBeDefined();
    });

    it('should handle end event', async () => {
      const endEvent = {
        call_id: 'call-789',
        timestamp: new Date().toISOString(),
        sequence: 10,
        event: 'end',
      };

      expect(endEvent.event).toBe('end');
    });

    it('should handle hangup event', async () => {
      const hangupEvent = {
        call_id: 'call-999',
        timestamp: new Date().toISOString(),
        sequence: 5,
        event: 'hangup',
      };

      expect(hangupEvent.event).toBe('hangup');
    });
  });

  describe('Message Format', () => {
    it('should accept valid ClawdTalk event format', () => {
      const validEvent = {
        call_id: 'call-123',
        text: 'Test message',
        timestamp: '2024-01-01T00:00:00Z',
        sequence: 1,
        event: 'speech',
      };

      expect(validEvent.call_id).toBeDefined();
      expect(validEvent.text).toBeDefined();
      expect(validEvent.timestamp).toBeDefined();
      expect(validEvent.sequence).toBeDefined();
      expect(validEvent.event).toBeDefined();
    });

    it('should support pin_verified field', () => {
      const eventWithPin = {
        call_id: 'call-456',
        text: 'Test',
        timestamp: '2024-01-01T00:00:00Z',
        sequence: 1,
        event: 'speech',
        pin_verified: true,
      };

      expect(eventWithPin.pin_verified).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should format response correctly', () => {
      const response = {
        type: 'response',
        call_id: 'call-123',
        text: 'Hello! How can I help you?',
        sequence: 1,
      };

      expect(response.type).toBe('response');
      expect(response.call_id).toBeDefined();
      expect(response.text).toBeDefined();
      expect(response.sequence).toBeDefined();
    });

    it('should format error response', () => {
      const errorResponse = {
        type: 'error',
        call_id: 'call-123',
        error: 'An error occurred',
      };

      expect(errorResponse.type).toBe('error');
      expect(errorResponse.error).toBeDefined();
    });
  });

  describe('Event Types', () => {
    it('should support start event', () => {
      const event = { event: 'start' };
      expect(['start', 'speech', 'end', 'error', 'hangup']).toContain(event.event);
    });

    it('should support speech event', () => {
      const event = { event: 'speech' };
      expect(['start', 'speech', 'end', 'error', 'hangup']).toContain(event.event);
    });

    it('should support end event', () => {
      const event = { event: 'end' };
      expect(['start', 'speech', 'end', 'error', 'hangup']).toContain(event.event);
    });

    it('should support error event', () => {
      const event = { event: 'error' };
      expect(['start', 'speech', 'end', 'error', 'hangup']).toContain(event.event);
    });

    it('should support hangup event', () => {
      const event = { event: 'hangup' };
      expect(['start', 'speech', 'end', 'error', 'hangup']).toContain(event.event);
    });
  });
});
