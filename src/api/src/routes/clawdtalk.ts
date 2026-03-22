/**
 * ClawdTalk Integration Routes
 *
 * WebSocket-based voice calling integration with ClawdTalk
 * Architecture: ClawdTalk <-> WebSocket <-> Cham.ai AI
 *
 * @route WS /api/v1/clawdtalk/webhook  - Main WebSocket endpoint
 * @route GET /api/v1/clawdtalk/status  - Health check
 *
 * ClawdTalk Message Format (Incoming):
 * {
 *   "call_id": "string",
 *   "text": "string",           // User speech transcribed
 *   "timestamp": "string",
 *   "sequence": number,
 *   "event": "start|speech|end"
 * }
 *
 * ClawdTalk Response Format (Outgoing):
 * {
 *   "type": "response",
 *   "call_id": "string",
 *   "text": "string",           // AI response to speak
 *   "sequence": number          // Echo incoming sequence
 * }
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Incoming event from ClawdTalk
const ClawdTalkEventSchema = z.object({
  call_id: z.string(),
  text: z.string().optional(),
  timestamp: z.string(),
  sequence: z.number(),
  event: z.enum(['start', 'speech', 'end', 'error', 'hangup']),
  pin_verified: z.boolean().optional(),
});

// Response to ClawdTalk
interface ClawdTalkResponse {
  type: 'response' | 'error' | 'hangup';
  call_id: string;
  text?: string;
  sequence?: number;
  error?: string;
}

// Active calls storage (in production, use Redis)
const activeCalls = new Map<string, {
  startTime: Date;
  lastActivity: Date;
  session_id?: string;
  assistant_id?: string;
  messages: Array<{ role: string; content: string }>;
}>();

// Clean up calls older than 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [callId, call] of activeCalls.entries()) {
    if (call.lastActivity.getTime() < oneHourAgo) {
      activeCalls.delete(callId);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

export async function clawdTalkRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/status', async () => {
    return {
      service: 'clawdtalk-integration',
      status: 'operational',
      active_calls: activeCalls.size,
      timestamp: new Date().toISOString(),
    };
  });

  // Main WebSocket endpoint for ClawdTalk
  fastify.register(async function (fastify: FastifyInstance) {
    fastify.get('/webhook', { websocket: true }, (connection, req) => {
      fastify.log.info('[ClawdTalk] WebSocket connection established');

      // Send connection acknowledgment
      connection.socket.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      }));

      connection.socket.on('message', async (data: Buffer) => {
        try {
          const rawMessage = data.toString();
          fastify.log.info(`[ClawdTalk] Received: ${rawMessage}`);

          const event = ClawdTalkEventSchema.parse(JSON.parse(rawMessage));

          // Update activity timestamp
          if (activeCalls.has(event.call_id)) {
            const call = activeCalls.get(event.call_id)!;
            call.lastActivity = new Date();
          }

          // Handle different event types
          switch (event.event) {
            case 'start': {
              // New call initiated
              fastify.log.info(`[ClawdTalk] Call started: ${event.call_id}`);

              activeCalls.set(event.call_id, {
                startTime: new Date(),
                lastActivity: new Date(),
                messages: [],
              });

              // Send greeting
              const response: ClawdTalkResponse = {
                type: 'response',
                call_id: event.call_id,
                text: 'Hello! This is Cham.ai. How can I help you today?',
                sequence: event.sequence,
              };
              connection.socket.send(JSON.stringify(response));
              break;
            }

            case 'speech': {
              // User spoke something
              if (!event.text) {
                fastify.log.warn(`[ClawdTalk] Speech event without text: ${event.call_id}`);
                break;
              }

              const call = activeCalls.get(event.call_id);
              if (!call) {
                fastify.log.warn(`[ClawdTalk] Speech from unknown call: ${event.call_id}`);
                break;
              }

              // Add user message to history
              call.messages.push({
                role: 'user',
                content: event.text,
              });

              // Process with AI
              const aiResponse = await processAIResponse(call.messages);

              // Add assistant response to history
              call.messages.push({
                role: 'assistant',
                content: aiResponse,
              });

              // Send response to ClawdTalk
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
              // Call ended
              fastify.log.info(`[ClawdTalk] Call ended: ${event.call_id}`);
              activeCalls.delete(event.call_id);
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
        } catch (error) {
          fastify.log.error(`[ClawdTalk] Error processing message:`, error);

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

      connection.socket.on('error', (error) => {
        fastify.log.error('[ClawdTalk] WebSocket error:', error);
      });
    });
  });
}

/**
 * Process conversation with AI
 * In production, this would call the actual AI service
 */
async function processAIResponse(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // TODO: Integrate with actual AI service
  // For now, return a simple response based on the last user message

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    return "I'm here to help. What would you like to know?";
  }

  const userText = lastMessage.content.toLowerCase();

  // Simple pattern matching for demo
  if (userText.includes('hello') || userText.includes('hi')) {
    return 'Hello! Welcome to Cham.ai voice assistant. How can I assist you today?';
  }

  if (userText.includes('help')) {
    return 'I can help you with various tasks. You can ask me questions, request information, or just have a conversation. What would you like to do?';
  }

  if (userText.includes('bye') || userText.includes('goodbye')) {
    return 'Goodbye! Thank you for calling Cham.ai. Have a great day!';
  }

  if (userText.includes('time')) {
    return `The current time is ${new Date().toLocaleTimeString()}`;
  }

  if (userText.includes('date')) {
    return `Today is ${new Date().toLocaleDateString()}`;
  }

  // Default response
  return 'I understand. Let me help you with that. Is there anything specific you would like to know or do?';
}
