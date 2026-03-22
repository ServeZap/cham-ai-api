/**
 * Health Check Routes
 *
 * @route GET /api/health
 * @route GET /api/ready
 * @route GET /api/metrics
 */

import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'cham-ai-api',
      version: '0.1.0',
    };
  });

  // Readiness probe (checks dependencies)
  fastify.get('/ready', async (request, reply) => {
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
    };

    const isReady = Object.values(checks).every((check) => check.status === 'ok');

    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'not_ready',
      checks,
    });
  });

  // Metrics endpoint (for Prometheus scraping)
  fastify.get('/metrics', async (request, reply) => {
    reply.type('text/plain');

    const metrics = [
      '# HELP cham_ai_uptime_seconds Uptime in seconds',
      '# TYPE cham_ai_uptime_seconds gauge',
      `cham_ai_uptime_seconds ${process.uptime()}`,
      '',
      '# HELP cham_ai_requests_total Total number of requests',
      '# TYPE cham_ai_requests_total counter',
      'cham_ai_requests_total 0',
    ];

    return metrics.join('\n');
  });
}

export async function checkDatabase() {
  try {
    // TODO: Implement actual database check
    return { status: 'ok', latency_ms: 5 };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function checkRedis() {
  try {
    // TODO: Implement actual Redis check
    return { status: 'ok', latency_ms: 2 };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
