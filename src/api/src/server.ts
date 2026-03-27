/**
 * Cham.ai API Server
 *
 * Voice AI Platform API
 * ServeZap Product
 *
 * @version 0.1.0
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import postgres from '@fastify/postgres';
import redis from '@fastify/redis';

import { healthRoutes } from './routes/health.js';
import { voiceRoutes } from './routes/voice.js';
import { callsRoutes } from './routes/calls.js';
import { sessionsRoutes } from './routes/sessions.js';
import { aiRoutes } from './routes/ai.js';
import { clawdTalkRoutes } from './routes/clawdtalk.js';
import { providersRoutes } from './routes/providers.js';
import { observabilityRoutes } from './routes/observability.js';
import { missionsRoutes } from './routes/missions.js';
import { adminRoutes } from './routes/admin.js';

import { errorHandler } from './handlers/error.js';
import { authHook } from './hooks/auth.js';
import { repositoriesPlugin } from './plugins/repositories.js';

export async function createServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Register plugins
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true,
  });

  await server.register(jwt, {
    secret: process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'change-me-in-production',
  });

  await server.register(websocket);

  // PostgreSQL
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) {
    await server.register(postgres, {
      connectionString: process.env.DATABASE_URL,
    });
  }

  // Redis
  if (process.env.REDIS_URL && process.env.REDIS_URL.length > 0) {
    await server.register(redis, {
      url: process.env.REDIS_URL,
    });
  }

  await server.register(swagger, {
    openapi: {
      info: {
        title: 'Cham.ai API',
        description: 'Voice AI Platform API',
        version: '0.1.0',
      },
      servers: [
        {
          url: 'http://localhost:8000',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await server.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register repository plugin (provides fastify.repositories.*)
  await server.register(repositoriesPlugin);

  // Register hooks
  server.addHook('onRequest', authHook);

  // Register routes
  await server.register(healthRoutes, { prefix: '/api' });
  await server.register(voiceRoutes, { prefix: '/api/v1/voice' });
  await server.register(callsRoutes, { prefix: '/api/v1/calls' });
  await server.register(sessionsRoutes, { prefix: '/api/v1/sessions' });
  await server.register(aiRoutes, { prefix: '/api/v1/ai' });
  await server.register(clawdTalkRoutes, { prefix: '/api/v1/clawdtalk' });
  await server.register(providersRoutes, { prefix: '/api/v1/providers' });
  await server.register(observabilityRoutes, { prefix: '/api/v1/observability' });
  await server.register(missionsRoutes, { prefix: '/api/v1/missions' });
  await server.register(adminRoutes, { prefix: '/api/v1/admin' });

  // Error handler
  server.setErrorHandler(errorHandler);

  return server;
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = await createServer();
  const port = parseInt(process.env.PORT || '8000', 10);
  const host = process.env.HOST || '0.0.0.0';

  await server.listen({ port, host });
  console.log(`Cham.ai API ready at http://${host}:${port}`);
  console.log(`API Docs: http://${host}:${port}/docs`);
}
