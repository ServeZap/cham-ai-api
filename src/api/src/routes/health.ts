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
      database: await checkDatabase(fastify),
      redis: await checkRedis(fastify),
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

async function checkDatabase(fastify: FastifyInstance) {
  try {
    const pg = (fastify as any).pg;
    if (!pg) return { status: 'ok', latency_ms: 0, note: 'pg plugin not registered' };

    const start = Date.now();
    await pg.query('SELECT 1');
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedis(fastify: FastifyInstance) {
  try {
    const redis = (fastify as any).redis;
    if (!redis) return { status: 'ok', latency_ms: 0, note: 'redis plugin not registered' };

    const start = Date.now();
    await redis.set('cham:health:check', '1', 'EX', 10);
    await redis.get('cham:health:check');
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export { checkDatabase, checkRedis };
