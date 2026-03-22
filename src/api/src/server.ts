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

import { healthRoutes } from './routes/health.js';
import { voiceRoutes } from './routes/voice.js';
import { callsRoutes } from './routes/calls.js';
import { sessionsRoutes } from './routes/sessions.js';
import { aiRoutes } from './routes/ai.js';
import { clawdTalkRoutes } from './routes/clawdtalk.js';

import { errorHandler } from './handlers/error.js';
import { authHook } from './hooks/auth.js';

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
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  await server.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
  });

  await server.register(websocket);

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

  // Register hooks
  server.addHook('onRequest', authHook);

  // Register routes
  await server.register(healthRoutes, { prefix: '/api' });
  await server.register(voiceRoutes, { prefix: '/api/v1/voice' });
  await server.register(callsRoutes, { prefix: '/api/v1/calls' });
  await server.register(sessionsRoutes, { prefix: '/api/v1/sessions' });
  await server.register(aiRoutes, { prefix: '/api/v1/ai' });
  await server.register(clawdTalkRoutes, { prefix: '/api/v1/clawdtalk' });

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
  console.log(`🚀 Cham.ai API ready at http://${host}:${port}`);
  console.log(`📚 API Docs: http://${host}:${port}/docs`);
}
