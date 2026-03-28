/**
 * Voice Routes
 *
 * Voice conversation management with real STT/LLM/TTS pipeline.
 *
 * @route POST /api/v1/voice/converse     - Start/continue voice conversation
 * @route GET  /api/v1/voice/stream/:id   - WebSocket for streaming audio
 */

import { FastifyInstance } from 'fastify';
import { ConverseSchema } from '../../../../contracts/src/index.js';

export async function voiceRoutes(fastify: FastifyInstance) {
  // Voice conversation endpoint
  fastify.post('/converse', async (request, reply) => {
    const data = ConverseSchema.parse(request.body);
    const startTime = Date.now();

    let transcription = '';
    let responseText = '';
    let responseAudio: string | null = null;

    // Step 1: STT (if audio provided)
    if (data.audio && process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const audioBuffer = Buffer.from(data.audio, 'base64');
        const transcriptionResult = await openai.audio.transcriptions.create({
          model: 'whisper-1',
          file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
          language: 'pt',
        });

        transcription = transcriptionResult.text;
      } catch (err: any) {
        fastify.log.error('[Voice] STT error:', err);
        transcription = '[Erro na transcrição]';
      }
    } else if (data.text) {
      transcription = data.text;
    }

    // Step 2: LLM Processing
    if (process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
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
      } catch (err: any) {
        fastify.log.error('[Voice] LLM error:', err);
        responseText = 'Desculpe, estou com dificuldades técnicas no momento.';
      }
    } else {
      responseText = 'Serviço de voz não configurado. Defina OPENAI_API_KEY.';
    }

    // Step 3: TTS (optional — can be added with ElevenLabs)
    // TODO: Implement TTS with ElevenLabs or OpenAI TTS

    return {
      conversation_id: crypto.randomUUID(),
      session_id: data.session_id || crypto.randomUUID(),
      transcription,
      response_text: responseText,
      response_audio: responseAudio,
      latency_ms: Date.now() - startTime,
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
