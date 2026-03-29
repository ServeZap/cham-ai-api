/**
 * AI Routes
 *
 * AI Engine endpoints — proxies to OpenClaw when AGENT_RUNTIME_URL is set,
 * falls back to direct OpenAI otherwise.
 *
 * @route POST /api/v1/ai/complete      - Complete text with AI
 * @route POST /api/v1/ai/tools         - Execute AI tool
 * @route GET  /api/v1/ai/prompts       - List available prompts
 */

import { FastifyInstance } from 'fastify';
import {
  CompleteSchema,
  ToolCallSchema,
} from '../../../../contracts/src/index.js';

/** Whether OpenClaw is configured as the AI backend */
function isOpenClawConfigured(): boolean {
  return !!process.env.AGENT_RUNTIME_URL;
}

/** Resolve the AI model name based on active backend */
function resolveModel(): string {
  if (isOpenClawConfigured()) {
    return process.env.OPENCLAW_MODEL || 'nadirclaw';
  }
  return process.env.AI_MODEL || 'gpt-4o';
}

export async function aiRoutes(fastify: FastifyInstance) {
  // Complete text with AI
  fastify.post('/complete', async (request, reply) => {
    const data = CompleteSchema.parse(request.body);
    const startTime = Date.now();

    const usingOpenClaw = isOpenClawConfigured();

    if (!process.env.OPENAI_API_KEY && !usingOpenClaw) {
      return {
        text: 'AI service not configured. Set OPENAI_API_KEY or AGENT_RUNTIME_URL.',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latency_ms: 0,
      };
    }

    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'no-key',
        ...(usingOpenClaw ? { baseURL: process.env.AGENT_RUNTIME_URL } : {}),
      });

      const model = resolveModel();
      fastify.log.info({ model, provider: usingOpenClaw ? 'openclaw' : 'openai', sessionId: data.session_id }, '[AI] Complete');

      const messages: any[] = [
        {
          role: 'system',
          content: 'Você é um assistente de IA profissional da Cham.ai. Ajude o usuário de forma clara e eficiente.',
        },
      ];

      // Add context if provided
      if (data.context) {
        if (data.context.history) {
          messages.push(...data.context.history);
        }
        if (data.context.systemPrompt) {
          messages[0].content = data.context.systemPrompt;
        }
      }

      messages.push({ role: 'user', content: data.prompt });

      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: data.context?.temperature ?? 0.7,
      });

      const choice = completion.choices[0];
      const text = choice?.message?.content || '';
      const usage = completion.usage;

      return {
        text,
        tool_calls: choice?.message?.tool_calls ?? null,
        finish_reason: choice?.finish_reason ?? null,
        usage: {
          prompt_tokens: usage?.prompt_tokens || 0,
          completion_tokens: usage?.completion_tokens || 0,
          total_tokens: usage?.total_tokens || 0,
        },
        latency_ms: Date.now() - startTime,
        provider: usingOpenClaw ? 'openclaw' : 'openai',
      };
    } catch (error: any) {
      fastify.log.error({ provider: usingOpenClaw ? 'openclaw' : 'openai', err: error.message }, '[AI] Complete error');
      return reply.status(503).send({
        error: 'AI model unavailable',
        code: 'AI_MODEL_UNAVAILABLE',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Execute AI tool
  fastify.post('/tools', async (request, reply) => {
    const data = ToolCallSchema.parse(request.body);
    const startTime = Date.now();

    // Available tools:
    // - search_knowledge_base
    // - get_user_info
    // - create_appointment
    // - send_notification
    // - create_lead (A7Protect)
    // - open_incident (A7Protect)

    // When OpenClaw is configured and conversation context is provided,
    // send the tool result back to OpenClaw for continuation.
    if (isOpenClawConfigured() && data.messages && data.messages.length > 0) {
      try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY || 'no-key',
          baseURL: process.env.AGENT_RUNTIME_URL,
        });

        const model = resolveModel();
        fastify.log.info(
          { model, tool: data.tool, toolCallId: data.tool_call_id, sessionId: data.session_id },
          '[AI] Tool result → OpenClaw'
        );

        // Build the tool result message in OpenAI format
        const toolResultMessage: any = {
          role: 'tool',
          tool_call_id: data.tool_call_id || data.tool,
          content: JSON.stringify(data.parameters),
        };

        const messages = [...data.messages, toolResultMessage];

        const completion = await openai.chat.completions.create({
          model,
          messages,
          temperature: 0.7,
        });

        const choice = completion.choices[0];

        return {
          result: {
            text: choice?.message?.content || '',
            tool_calls: choice?.message?.tool_calls ?? null,
            finish_reason: choice?.finish_reason ?? null,
          },
          tool: data.tool,
          execution_time_ms: Date.now() - startTime,
          provider: 'openclaw',
        };
      } catch (error: any) {
        fastify.log.error({ tool: data.tool, err: error.message }, '[AI] Tool execution error');
        return reply.status(503).send({
          error: 'Tool execution failed',
          code: 'TOOL_EXECUTION_FAILED',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }
    }

    // Fallback: return parameters as-is (no AI continuation)
    return {
      result: data.parameters,
      tool: data.tool,
      execution_time_ms: Date.now() - startTime,
    };
  });

  // List available prompts
  fastify.get('/prompts', async (request, reply) => {
    return {
      prompts: [
        {
          id: 'customer-support',
          name: 'Customer Support',
          description: 'General customer support assistant',
        },
        {
          id: 'appointment-scheduler',
          name: 'Appointment Scheduler',
          description: 'Schedule and manage appointments',
        },
        {
          id: 'sales-qualifier',
          name: 'Sales Qualifier',
          description: 'Qualify sales leads',
        },
      ],
    };
  });
}
