/**
 * AI Routes
 *
 * AI Engine endpoints (LangGraph / OpenAI)
 *
 * @route POST /api/v1/ai/complete      - Complete text with AI
 * @route POST /api/v1/ai/tools         - Execute AI tool
 * @route GET  /api/v1/ai/prompts       - List available prompts
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const CompleteSchema = z.object({
  prompt: z.string().min(1),
  session_id: z.string().uuid().optional(),
  context: z.record(z.any()).optional(),
});

const ToolSchema = z.object({
  tool: z.string().min(1),
  parameters: z.record(z.any()),
});

export async function aiRoutes(fastify: FastifyInstance) {
  // Complete text with AI
  fastify.post('/complete', async (request, reply) => {
    const data = CompleteSchema.parse(request.body);
    const startTime = Date.now();

    if (!process.env.OPENAI_API_KEY) {
      return {
        text: 'AI service not configured. Set OPENAI_API_KEY.',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latency_ms: 0,
      };
    }

    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
      });

      const text = completion.choices[0]?.message?.content || '';
      const usage = completion.usage;

      return {
        text,
        usage: {
          prompt_tokens: usage?.prompt_tokens || 0,
          completion_tokens: usage?.completion_tokens || 0,
          total_tokens: usage?.total_tokens || 0,
        },
        latency_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      fastify.log.error('[AI] Complete error:', error);
      return reply.status(503).send({
        error: 'AI model unavailable',
        code: 'AI_MODEL_UNAVAILABLE',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Execute AI tool
  fastify.post('/tools', async (request, reply) => {
    const data = ToolSchema.parse(request.body);
    const startTime = Date.now();

    // Available tools:
    // - search_knowledge_base
    // - get_user_info
    // - create_appointment
    // - send_notification
    // - create_lead (A7Protect)
    // - open_incident (A7Protect)

    // TODO: Implement tool execution via LangGraph or direct integration

    return {
      result: {},
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
