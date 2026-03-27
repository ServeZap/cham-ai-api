/**
 * Error Handler - Cham.ai
 *
 * Custom error handler with Cham.ai-specific error codes.
 * No external shared package dependency.
 */

import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

// ── Custom Error Classes ──────────────────────────────────────────

export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(message: string, code: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Error', details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(message, 'INTERNAL_ERROR', 500);
    this.name = 'InternalError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Cham.ai specific error codes
 */
export const CHAM_AI_ERROR_CODES: Record<string, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  ALREADY_EXISTS: 409,
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

// ── Cham.ai specific errors ───────────────────────────────────────

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
  constructor(message: string) {
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

// ── Error Handler ─────────────────────────────────────────────────

function formatResponse(
  error: FastifyError,
  statusCode: number
): { error: string; code?: string; details?: any } {
  let errorMessage = error.message || 'An error occurred';
  let errorCode = error.code;

  // Handle validation errors
  if (error.validation) {
    errorMessage = 'Validation Error';
    errorCode = 'VALIDATION_ERROR';
  } else if (!errorCode) {
    if (statusCode === 500) {
      errorCode = 'INTERNAL_ERROR';
      errorMessage = 'Internal Server Error';
    }
  }

  const response: any = { error: errorMessage };
  if (errorCode) response.code = errorCode;
  if (error.validation) response.details = error.validation;
  else if (process.env.NODE_ENV === 'development' && !error.validation && error.message && statusCode === 500) {
    response.details = error.message;
  }

  return response;
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Skip logging for health check paths
  const skipLogPaths = ['/api/health', '/api/ready', '/api/metrics'];
  if (!skipLogPaths.some((path) => request.url?.startsWith(path)) && request.log?.error) {
    request.log.error(error);
  }

  const statusCode = error.statusCode || (error.validation ? 400 : CHAM_AI_ERROR_CODES[error.code as string]) || 500;
  const response = formatResponse(error, statusCode);

  reply.status(statusCode).send(response);
}
