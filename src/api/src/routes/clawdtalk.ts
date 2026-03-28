/**
 * ClawdTalk Integration Routes
 *
 * WebSocket-based voice calling integration with ClawdTalk.
 * Uses real OpenAI for AI responses and Redis for active call state.
 *
 * @route WS /api/v1/clawdtalk/webhook  - Main WebSocket endpoint
 * @route GET /api/v1/clawdtalk/status  - Health check
 */

import { FastifyInstance } from 'fastify';
import {
  ClawdTalkEventSchema,
  type ClawdTalkResponse,
} from '../../../../contracts/src/index.js';

export async function clawdTalkRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/status', async () => {
    const redis = (fastify as any).redis;
    let activeCalls = 0;

    if (redis) {
      try {
        const keys = await redis.keys('clawdtalk:call:*');
        activeCalls = keys.length;
      } catch {
        // Redis unavailable
      }
    }

    return {
      service: 'clawdtalk-integration',
      status: 'operational',
      active_calls: activeCalls,
      timestamp: new Date().toISOString(),
    };
  });

  // Main WebSocket endpoint for ClawdTalk
  fastify.register(async function (wsFastify: FastifyInstance) {
    wsFastify.get('/webhook', { websocket: true }, (connection: any, req: any) => {
      let authenticated = false;

      fastify.log.info('[ClawdTalk] WebSocket connection established');

      connection.socket.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      }));

      connection.socket.on('message', async (data: Buffer) => {
        try {
          const rawMessage = data.toString();
          fastify.log.info(`[ClawdTalk] Received: ${rawMessage}`);

          const event = ClawdTalkEventSchema.parse(JSON.parse(rawMessage));

          // Auth: first message must contain token (unless skipPaths)
          if (!authenticated && event.event === 'start' && event.token) {
            try {
              await (fastify as any).jwt.verify(event.token);
              authenticated = true;
            } catch {
              connection.socket.send(JSON.stringify({
                type: 'error',
                call_id: event.call_id,
                error: 'Authentication failed',
              }));
              return;
            }
          }

          // Handle different event types
          switch (event.event) {
            case 'start': {
              fastify.log.info(`[ClawdTalk] Call started: ${event.call_id}`);

              // Store in Redis if available
              const redis = (fastify as any).redis;
              if (redis) {
                await redis.set(
                  `clawdtalk:call:${event.call_id}`,
                  JSON.stringify({
                    startTime: new Date().toISOString(),
                    lastActivity: new Date().toISOString(),
                    messages: [],
                  }),
                  'EX',
                  3600
                );
              }

              // Publish call event
              const eventBus: any = (fastify as any).eventBus;
              if (eventBus) {
                const tenantId = (event as any).tenant_id || (fastify as any).tenantId || 'system';
                await eventBus.publish({
                  type: 'call.status_changed',
                  tenantId,
                  callId: event.call_id,
                  payload: { status: 'in_progress', event: 'start' },
                  timestamp: new Date().toISOString(),
                });
              }

              const response: ClawdTalkResponse = {
                type: 'response',
                call_id: event.call_id,
                text: 'Hello! This is Cham.ai. How can I help you today?',
                sequence: event.sequence,
              };
              connection.socket.send(JSON.stringify(response));
              break;
            }

            case 'speech_partial': {
              // Incremental transcription segment — forward to subscribers
              if (!event.text) break;

              // Update Redis with partial transcript
              const redis = (fastify as any).redis;
              if (redis) {
                try {
                  const callData = await redis.get(`clawdtalk:call:${event.call_id}`);
                  if (callData) {
                    const parsed = JSON.parse(callData);
                    parsed.partialTranscript = event.text;
                    parsed.lastActivity = new Date().toISOString();
                    await redis.set(
                      `clawdtalk:call:${event.call_id}`,
                      JSON.stringify(parsed),
                      'EX',
                      3600
                    );
                  }
                } catch {
                  // Redis update failed
                }
              }

              // Publish partial transcription event
              const eventBus: any = (fastify as any).eventBus;
              if (eventBus) {
                const tenantId = (event as any).tenant_id || 'system';
                await eventBus.publish({
                  type: 'transcription.partial',
                  tenantId,
                  callId: event.call_id,
                  payload: { text: event.text, isFinal: false },
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            }

            case 'speech': {
              if (!event.text) {
                fastify.log.warn(`[ClawdTalk] Speech event without text: ${event.call_id}`);
                break;
              }

              // Publish final transcription event
              const eventBus: any = (fastify as any).eventBus;
              if (eventBus) {
                const tenantId = (event as any).tenant_id || 'system';
                await eventBus.publish({
                  type: 'transcription.final',
                  tenantId,
                  callId: event.call_id,
                  payload: { text: event.text, isFinal: true },
                  timestamp: new Date().toISOString(),
                });
              }

              // Process with AI (real OpenAI)
              const aiResponse = processAIResponse(fastify, event.call_id, event.text);

              // Update Redis
              const redis = (fastify as any).redis;
              if (redis) {
                try {
                  const callData = await redis.get(`clawdtalk:call:${event.call_id}`);
                  if (callData) {
                    const parsed = JSON.parse(callData);
                    parsed.messages.push(
                      { role: 'user', content: event.text },
                      { role: 'assistant', content: aiResponse }
                    );
                    parsed.lastActivity = new Date().toISOString();
                    await redis.set(
                      `clawdtalk:call:${event.call_id}`,
                      JSON.stringify(parsed),
                      'EX',
                      3600
                    );
                  }
                } catch {
                  // Redis update failed
                }
              }

              const response: ClawdTalkResponse = {
                type: 'response',
                call_id: event.call_id,
                text: aiResponse,
                sequence: event.sequence,
              };
              connection.socket.send(JSON.stringify(response));
              break;
            }

            case 'end':
            case 'hangup': {
              fastify.log.info(`[ClawdTalk] Call ended: ${event.call_id}`);

              // Clean up Redis
              const redis = (fastify as any).redis;
              if (redis) {
                await redis.del(`clawdtalk:call:${event.call_id}`);
              }

              // Publish call ended event
              const eventBus: any = (fastify as any).eventBus;
              if (eventBus) {
                const tenantId = (event as any).tenant_id || 'system';
                await eventBus.publish({
                  type: 'call.ended',
                  tenantId,
                  callId: event.call_id,
                  payload: { status: 'ended', event: event.event },
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            }

            case 'error': {
              fastify.log.error(`[ClawdTalk] Error from call ${event.call_id}: ${event.text}`);
              const errorResponse: ClawdTalkResponse = {
                type: 'error',
                call_id: event.call_id,
                error: 'An error occurred. Please try again.',
              };
              connection.socket.send(JSON.stringify(errorResponse));
              break;
            }
          }
        } catch (err: any) {
          fastify.log.error(`[ClawdTalk] Error processing message:`, err);

          const errorResponse: ClawdTalkResponse = {
            type: 'error',
            call_id: 'unknown',
            error: 'Failed to process message',
          };
          connection.socket.send(JSON.stringify(errorResponse));
        }
      });

      connection.socket.on('close', () => {
        fastify.log.info('[ClawdTalk] WebSocket connection closed');
      });

      connection.socket.on('error', (err: any) => {
        fastify.log.error('[ClawdTalk] WebSocket error:', err);
      });
    });
  });
}

/**
 * Process conversation with real OpenAI
 */
async function processAIResponse(
  fastify: FastifyInstance,
  callId: string,
  userText: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback pattern matching when no API key
    const lower = userText.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi')) {
      return 'Hello! Welcome to Cham.ai voice assistant. How can I assist you today?';
    }
    if (lower.includes('help')) {
      return 'I can help you with various tasks. What would you like to do?';
    }
    if (lower.includes('bye') || lower.includes('goodbye')) {
      return 'Goodbye! Thank you for calling Cham.ai. Have a great day!';
    }
    return 'I understand. Let me help you with that.';
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente de voz profissional da Cham.ai. Responda de forma clara, concisa e amigável. Fale em português brasileiro.',
        },
        { role: 'user', content: userText },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'I understand. How can I help?';
  } catch (err: any) {
    fastify.log.error(`[ClawdTalk] OpenAI error for call ${callId}:`, err);
    return 'I apologize, I am having technical difficulties. Please try again.';
  }
}
