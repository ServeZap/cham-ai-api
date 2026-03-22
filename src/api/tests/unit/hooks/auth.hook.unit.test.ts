import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authHook } from '../../../src/hooks/auth.js';

describe('Auth Hook', () => {
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    mockRequest = {
      url: '/api/v1/sessions',
      jwtVerify: vi.fn().mockResolvedValue(true),
    };

    mockReply = {
      send: vi.fn(),
    };
  });

  describe('Skip Authentication', () => {
    it('should skip auth for /api/v1/voice/converse', async () => {
      mockRequest.url = '/api/v1/voice/converse';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should skip auth for /api/v1/calls/inbound', async () => {
      mockRequest.url = '/api/v1/calls/inbound';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should skip auth for paths starting with /api/v1/voice/converse', async () => {
      mockRequest.url = '/api/v1/voice/converse?param=value';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).not.toHaveBeenCalled();
    });

    it('should skip auth for paths starting with /api/v1/calls/inbound', async () => {
      mockRequest.url = '/api/v1/calls/inbound/webhook';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).not.toHaveBeenCalled();
    });
  });

  describe('Require Authentication', () => {
    it('should call jwtVerify for protected routes', async () => {
      mockRequest.url = '/api/v1/sessions';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalledWith();
    });

    it('should call jwtVerify for /api/v1/calls/outbound', async () => {
      mockRequest.url = '/api/v1/calls/outbound';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalledWith();
    });

    it('should call jwtVerify for /api/v1/sessions/:id', async () => {
      mockRequest.url = '/api/v1/sessions/123';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalledWith();
    });

    it('should call jwtVerify for /api/v1/ai/complete', async () => {
      mockRequest.url = '/api/v1/ai/complete';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalledWith();
    });

    it('should call jwtVerify for /api/v1/ai/tools', async () => {
      mockRequest.url = '/api/v1/ai/tools';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalledWith();
    });

    it('should call jwtVerify for /api/v1/ai/prompts', async () => {
      mockRequest.url = '/api/v1/ai/prompts';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalledWith();
    });

    it('should call jwtVerify for /api/v1/calls/:id', async () => {
      mockRequest.url = '/api/v1/calls/call-123';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalledWith();
    });

    it('should call jwtVerify for /api/v1/calls/:id/recording', async () => {
      mockRequest.url = '/api/v1/calls/call-123/recording';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalledWith();
    });
  });

  describe('Authentication Failure', () => {
    it('should send error when jwtVerify throws', async () => {
      const authError = new Error('Invalid token');
      mockRequest.url = '/api/v1/sessions';
      mockRequest.jwtVerify = vi.fn().mockRejectedValue(authError);

      await authHook(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(authError);
    });

    it('should send error when jwtVerify fails with expired token', async () => {
      const expiredError = new Error('Token expired');
      mockRequest.url = '/api/v1/calls/outbound';
      mockRequest.jwtVerify = vi.fn().mockRejectedValue(expiredError);

      await authHook(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(expiredError);
    });
  });

  describe('Authentication Success', () => {
    it('should not send reply when jwtVerify succeeds', async () => {
      mockRequest.url = '/api/v1/sessions';

      await authHook(mockRequest, mockReply);

      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should proceed with request when jwtVerify succeeds', async () => {
      mockRequest.url = '/api/v1/ai/complete';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined url', async () => {
      mockRequest.url = undefined;

      // Should not skip auth if url is undefined
      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
    });

    it('should handle empty url', async () => {
      mockRequest.url = '';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
    });

    it('should handle url with query parameters', async () => {
      mockRequest.url = '/api/v1/sessions?page=2&limit=10';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
    });

    it('should not skip partial matches of skip paths', async () => {
      mockRequest.url = '/api/v1/voice/converse-extra';

      await authHook(mockRequest, mockReply);

      // Should not skip because it starts with /api/v1/voice/converse
      expect(mockRequest.jwtVerify).not.toHaveBeenCalled();
    });

    it('should require auth for /api/v1/voice/stream/:id', async () => {
      mockRequest.url = '/api/v1/voice/stream/session-123';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
    });
  });

  describe('WebSocket Endpoints', () => {
    it('should require auth for WebSocket stream endpoint', async () => {
      mockRequest.url = '/api/v1/voice/stream/session-123';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
    });

    it('should skip auth for inbound call webhook', async () => {
      mockRequest.url = '/api/v1/calls/inbound';

      await authHook(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).not.toHaveBeenCalled();
    });
  });
});
