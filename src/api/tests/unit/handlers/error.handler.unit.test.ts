import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorHandler } from '../../../src/handlers/error.js';

describe('Error Handler', () => {
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    mockRequest = {
      log: {
        error: vi.fn(),
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Validation Errors', () => {
    it('should handle validation errors with 400 status', async () => {
      const error = {
        validation: [
          {
            field: 'message',
            message: 'Message is required',
          },
        ],
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        details: error.validation,
      });
    });

    it('should log validation errors', async () => {
      const error = {
        validation: [{ field: 'text', message: 'Text is required' }],
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockRequest.log.error).toHaveBeenCalledWith(error);
    });
  });

  describe('Known Error Codes', () => {
    it('should handle SESSION_NOT_FOUND errors with 404 status', async () => {
      const error = {
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    });

    it('should handle CALL_NOT_FOUND errors with 404 status', async () => {
      const error = {
        message: 'Call not found',
        code: 'CALL_NOT_FOUND',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Call not found',
        code: 'CALL_NOT_FOUND',
      });
    });

    it('should handle RECORDING_NOT_FOUND errors with 404 status', async () => {
      const error = {
        message: 'Recording not found',
        code: 'RECORDING_NOT_FOUND',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Recording not found',
        code: 'RECORDING_NOT_FOUND',
      });
    });

    it('should handle NOT_FOUND errors with 404 status', async () => {
      const error = {
        message: 'Resource not found',
        code: 'NOT_FOUND',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });

    it('should handle UNAUTHORIZED errors with 401 status', async () => {
      const error = {
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
    });

    it('should handle FORBIDDEN errors with 403 status', async () => {
      const error = {
        message: 'Access denied',
        code: 'FORBIDDEN',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });

    it('should handle ALREADY_EXISTS errors with 409 status', async () => {
      const error = {
        message: 'Resource already exists',
        code: 'ALREADY_EXISTS',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
    });
  });

  describe('Unknown Errors', () => {
    it('should handle unknown errors with 500 status', async () => {
      const error = new Error('Something went wrong') as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should log unknown errors', async () => {
      const error = new Error('Unknown error') as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockRequest.log.error).toHaveBeenCalledWith(error);
    });

    it('should include error details in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Debug this error') as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        details: 'Debug this error',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include error details in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Production error') as any;

      await errorHandler(error, mockRequest, mockReply);

      const sentData = mockReply.send.mock.calls[0][0];
      expect(sentData).not.toHaveProperty('details');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Edge Cases', () => {
    it('should handle error without message', async () => {
      const error = {
        code: 'NOT_FOUND',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });

    it('should handle error without code', async () => {
      const error = {
        message: 'Error without code',
      } as any;

      await errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
    });
  });
});
