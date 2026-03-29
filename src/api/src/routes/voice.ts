/**
 * Voice Routes
 *
 * Voice conversation management with real STT/LLM/TTS pipeline.
 * Routes to OpenClaw when AGENT_RUNTIME_URL is configured.
 *
 * @route POST /api/v1/voice/converse     - Start/continue voice conversation
 * @route GET  /api/v1/voice/stream/:id   - WebSocket for streaming audio
 */

import { FastifyInstance } from 'fastify';
import { ConverseSchema } from '../../../../contracts/src/index.js';
import { estimateCost, buildUsageInsertSQL, type UsageRecord } from '../services/cost-tracker.js';

/** Whether OpenClaw is configured as the AI backend */
function isOpenClawConfigured(): boolean {
  return !!process.env.AGENT_RUNTIME_URL;
}

/** Build OpenAI client — routes to OpenClaw or direct OpenAI */
async function buildOpenAIClient() {
  const OpenAI = (await import('openai')).default;
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'no-key',
    ...(isOpenClawConfigured() ? { baseURL: process.env.AGENT_RUNTIME_URL } : {}),
  });
}

/** Resolve LLM model name */
function resolveModel(): string {
  if (isOpenClawConfigured()) {
    return process.env.OPENCLAW_MODEL || 'nadirclaw';
  }
  return process.env.AI_MODEL || 'gpt-4o';
}

export async function voiceRoutes(fastify: FastifyInstance) {
  // Voice conversation endpoint
  fastify.post('/converse', async (request, reply) => {
    const data = ConverseSchema.parse(request.body);
    const startTime = Date.now();

    let transcription = '';
    let responseText = '';
    let responseAudio: string | null = null;

    // Cost tracking accumulators
    let sttDurationMs = 0;
    let llmPromptTokens = 0;
    let llmCompletionTokens = 0;
    let llmTotalTokens = 0;
    let ttsCharacters = 0;

    const hasAI = process.env.OPENAI_API_KEY || isOpenClawConfigured();

    // Step 1: STT (if audio provided)
    if (data.audio && process.env.OPENAI_API_KEY) {
      try {
        const sttStart = Date.now();
        const openai = await buildOpenAIClient();

        const audioBuffer = Buffer.from(data.audio, 'base64');
        const transcriptionResult = await openai.audio.transcriptions.create({
          model: 'whisper-1',
          file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
          language: 'pt',
        });

        transcription = transcriptionResult.text;
        sttDurationMs = Date.now() - sttStart;
      } catch (err: any) {
        fastify.log.error('[Voice] STT error:', err);
        transcription = '[Erro na transcrição]';
      }
    } else if (data.text) {
      transcription = data.text;
    }

    // Step 2: LLM Processing
    if (hasAI) {
      try {
        const openai = await buildOpenAIClient();
        const model = resolveModel();

        fastify.log.info({ model, provider: isOpenClawConfigured() ? 'openclaw' : 'openai' }, '[Voice] LLM');

        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente de voz profissional da Cham.ai. Responda de forma clara e concisa.',
            },
            {
              role: 'user',
              content: transcription || 'Olá',
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        });

        responseText = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar.';
        llmPromptTokens = completion.usage?.prompt_tokens || 0;
        llmCompletionTokens = completion.usage?.completion_tokens || 0;
        llmTotalTokens = completion.usage?.total_tokens || 0;
      } catch (err: any) {
        fastify.log.error('[Voice] LLM error:', err);
        responseText = 'Desculpe, estou com dificuldades técnicas no momento.';
      }
    } else {
      responseText = 'Serviço de voz não configurado. Defina OPENAI_API_KEY ou AGENT_RUNTIME_URL.';
    }

    // Step 3: TTS — convert response text to audio
    if (responseText && hasAI) {
      try {
        const openai = await buildOpenAIClient();
        const ttsModel = isOpenClawConfigured()
          ? (process.env.OPENCLAW_TTS_MODEL || 'tts-1')
          : 'tts-1';

        fastify.log.info({ ttsModel, provider: isOpenClawConfigured() ? 'openclaw' : 'openai' }, '[Voice] TTS');

        const ttsResponse = await openai.audio.speech.create({
          model: ttsModel,
          voice: process.env.TTS_VOICE || 'alloy',
          input: responseText,
          response_format: 'mp3',
        });

        const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
        responseAudio = audioBuffer.toString('base64');
        ttsCharacters = responseText.length;
      } catch (err: any) {
        fastify.log.error('[Voice] TTS error:', err);
        // TTS is optional — don't fail the whole request
      }
    }

    // Track cost governance (fire-and-forget)
    const jwtPayload = (request as any).user || {};
    const db = (fastify as any).db;
    if (db && jwtPayload.app_metadata?.tenant_id) {
      const usage: UsageRecord = {
        tenant_id: jwtPayload.app_metadata.tenant_id,
        session_id: data.session_id || undefined,
        stt_provider: data.audio ? 'whisper-1' : undefined,
        stt_duration_ms: sttDurationMs || undefined,
        llm_provider: isOpenClawConfigured() ? 'openclaw' : (process.env.OPENAI_API_KEY ? 'openai' : undefined),
        llm_model: resolveModel(),
        llm_prompt_tokens: llmPromptTokens || undefined,
        llm_completion_tokens: llmCompletionTokens || undefined,
        llm_total_tokens: llmTotalTokens || undefined,
        tts_provider: responseAudio ? (isOpenClawConfigured() ? 'openclaw' : 'openai') : undefined,
        tts_characters: ttsCharacters || undefined,
      };
      const costs = estimateCost(usage);
      const { sql, params } = buildUsageInsertSQL(usage, costs);
      db.query(sql, params).catch((err: any) => {
        fastify.log.error({ err }, '[Cost] Failed to track voice usage');
      });
    }

    return {
      conversation_id: crypto.randomUUID(),
      session_id: data.session_id || crypto.randomUUID(),
      transcription,
      response_text: responseText,
      response_audio: responseAudio,
      latency_ms: Date.now() - startTime,
      provider: isOpenClawConfigured() ? 'openclaw' : 'openai',
    };
  });

  // WebSocket endpoint for streaming
  fastify.register(async function (fastify: FastifyInstance) {
    fastify.get('/stream/:id', { websocket: true }, (connection: any, req: any) => {
      const { id } = req.params;
      fastify.log.info(`[Voice] WebSocket stream connected for ${id}`);

      connection.socket.on('message', async (message: any) => {
        try {
          // TODO: Handle streaming audio
          connection.socket.send(JSON.stringify({
            type: 'response',
            text: 'Echo: ' + message,
          }));
        } catch (err: any) {
          fastify.log.error('[Voice] Stream error:', err);
        }
      });

      connection.socket.on('close', () => {
        fastify.log.info(`[Voice] WebSocket stream closed for ${id}`);
      });
    });
  });
}
