/**
 * Error Handler - Cham.ai
 *
 * Uses shared error handler with Cham.ai-specific error codes.
 * Now includes V2 with enhanced features.
 */

import {
  createErrorHandler,
  ErrorCodeMap,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
} from '@servezap/shared/api/error-handler';

import {
  createErrorHandler as createErrorHandlerV2,
  ForbiddenError,
  InternalError,
  ServiceUnavailableError,
  ErrorHandlerOptions as ErrorHandlerOptionsV2,
  getErrorCode,
  isCustomError,
} from '@servezap/shared/api/error-handler.v2';
import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Cham.ai specific error codes
 */
export const CHAM_AI_ERROR_CODES: ErrorCodeMap = {
  // Shared error codes
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  ALREADY_EXISTS: 409,

  // Cham.ai specific error codes
  CALL_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  RECORDING_NOT_FOUND: 404,
  TRANSCRIPTION_NOT_FOUND: 404,
  TWILIO_ERROR: 502,
  TRANSCRIPTION_FAILED: 500,
  VOICE_MAIL_FULL: 503,
  AI_MODEL_UNAVAILABLE: 503,
  QUOTA_EXCEEDED: 429,
};

/**
 * Custom format response for Cham.ai
 * Matches legacy error handler API for test compatibility
 */
function chamAiFormatResponse(
  error: FastifyError,
  statusCode: number
): { error: string; code?: string; details?: any } {
  // Determine error message and code
  let errorMessage = error.message || 'An error occurred';
  let errorCode = error.code;

  // Handle validation errors
  if (error.validation) {
    errorMessage = 'Validation Error';
    errorCode = 'VALIDATION_ERROR';
  }
  // Handle unknown errors (no code)
  else if (!errorCode) {
    if (statusCode === 500) {
      errorCode = 'INTERNAL_ERROR';
      errorMessage = 'Internal Server Error';
    }
  }

  const response: any = {
    error: errorMessage,
  };

  // Add code if available
  if (errorCode) {
    response.code = errorCode;
  }

  // Add details for validation errors
  if (error.validation) {
    response.details = error.validation;
  }
  // In development mode, for unknown errors, include original error message in details
  else if (process.env.NODE_ENV === 'development' && !error.validation && error.message && statusCode === 500) {
    response.details = error.message;
  }

  return response;
}

/**
 * Custom error handler that matches legacy logging behavior
 */
export function createChamAiErrorHandler(options: {
  skipLogPaths?: string[];
} = {}) {
  const baseHandler = createErrorHandler({
    errorCodes: CHAM_AI_ERROR_CODES,
    logErrors: false, // We'll handle logging ourselves
    skipLogPaths: [],
    formatResponse: chamAiFormatResponse,
  });

  return async function errorHandler(
    this: any,
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Log error using legacy format (raw error object) unless it's a skip path
    const shouldSkipLog = options.skipLogPaths?.some((path) =>
      request.url?.startsWith(path)
    );

    if (!shouldSkipLog && request.log?.error) {
      request.log.error(error);
    }

    // Call the base handler
    return baseHandler.call(this, error, request, reply);
  };
}

/**
 * V2 Error Handler with enhanced features
 * Use this for new code with better type safety and monitoring
 */
export function createChamAiErrorHandlerV2(options: ErrorHandlerOptionsV2 = {}) {
  return createErrorHandlerV2({
    ...options,
    errorCodes: CHAM_AI_ERROR_CODES,
    redactSensitiveData: options.redactSensitiveData ?? true,
    includeStackTrace: options.includeStackTrace ?? (process.env.NODE_ENV === 'development'),
  });
}

/**
 * Create Cham.ai error handler
 */
export const errorHandler = createChamAiErrorHandler({
  skipLogPaths: ['/api/health', '/api/ready', '/api/metrics'],
});

/**
 * V2 Error Handler instance (enhanced version)
 */
export const errorHandlerV2 = createChamAiErrorHandlerV2({
  skipLogPaths: ['/api/health', '/api/ready', '/api/metrics'],
  onError: (error, statusCode, request) => {
    // Send metrics to monitoring system
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Prometheus/DataDog
      console.error(`[ERROR] ${statusCode} ${error.code}:`, error.message);
    }
  },
});

// Re-export shared errors for convenience
export {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
  InternalError,
  ServiceUnavailableError,
};

/**
 * Cham.ai specific error classes
 */

export class CallNotFoundError extends NotFoundError {
  constructor(callId: string) {
    super('Call', callId);
    this.code = 'CALL_NOT_FOUND';
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super('Session', sessionId);
    this.code = 'SESSION_NOT_FOUND';
  }
}

export class TranscriptionFailedError extends InternalError {
  constructor(callId: string, reason: string) {
    super(`Transcription failed for call ${callId}: ${reason}`);
    this.code = 'TRANSCRIPTION_FAILED';
  }
}

export class TwilioError extends ServiceUnavailableError {
  constructor(message: string, twilioError?: any) {
    super(`Twilio error: ${message}`);
    this.code = 'TWILIO_ERROR';
  }
}

export class QuotaExceededError extends ConflictError {
  constructor(quotaType: 'calls' | 'minutes' | 'transcriptions', current: number, limit: number) {
    super(`${quotaType} quota exceeded (${current}/${limit})`, { quotaType, current, limit });
    this.code = 'QUOTA_EXCEEDED';
  }
}
