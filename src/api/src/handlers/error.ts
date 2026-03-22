/**
 * Error Handler
 *
 * Global error handler for Fastify
 */

import { FastifyError } from 'fastify';

export async function errorHandler(
  error: FastifyError,
  request: any,
  reply: any
) {
  // Log error
  request.log.error(error);

  // Handle validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      details: error.validation,
    });
  }

  // Handle known errors
  if (error.code) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      ALREADY_EXISTS: 409,
      SESSION_NOT_FOUND: 404,
      CALL_NOT_FOUND: 404,
      RECORDING_NOT_FOUND: 404,
    };

    const status = statusMap[error.code] || 500;

    return reply.status(status).send({
      error: error.message,
      code: error.code,
    });
  }

  // Handle unknown errors
  return reply.status(500).send({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      details: error.message,
    }),
  });
}
