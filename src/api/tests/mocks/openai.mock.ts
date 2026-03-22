/**
 * OpenAI API Mock
 *
 * Mock para testes de integração com OpenAI API (GPT-4o, Whisper, TTS)
 */

import { vi } from 'vitest';

export class OpenAIMock {
  private responses: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultResponses();
  }

  private initializeDefaultResponses() {
    this.responses.set('chat', {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [{
        message: {
          role: 'assistant',
          content: 'This is a mocked response for testing.',
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 20,
        total_tokens: 70,
      },
    });

    this.responses.set('transcribe', {
      task: 'transcription',
      language: 'en',
      duration: 1.5,
      text: 'This is a mocked transcription.',
      words: [
        {
          word: 'This',
          start: 0.0,
          end: 0.5,
        },
        {
          word: 'is',
          start: 0.6,
          end: 0.8,
        },
        {
          word: 'a',
          start: 0.9,
          end: 1.0,
        },
        {
          word: 'test',
          start: 1.1,
          end: 1.5,
        },
      ],
    });
  }

  async chat(messages: any[], options?: any) {
    const mockResponse = this.responses.get('chat');

    // Check if there's a custom response set
    const customResponse = this.responses.get(`chat-${JSON.stringify(messages)}`);
    if (customResponse) {
      return customResponse;
    }

    return mockResponse;
  }

  async transcribe(audio: Buffer, options?: any) {
    return this.responses.get('transcribe');
  }

  async createTranscription(jobName: string, audio: Buffer) {
    return {
      status: 'processing',
      created_at: new Date().toISOString(),
    };
  }

  async getTranscription(jobName: string) {
    return this.responses.get('transcribe');
  }

  async createSpeech(text: string, voice?: string) {
    return {
      id: `speech-${Date.now()}`,
      audio: 'base64encodedaudio',
      duration_ms: 1200,
    };
  }

  setCustomResponse(key: string, response: any) {
    this.responses.set(key, response);
  }

  reset() {
    this.initializeDefaultResponses();
  }
}

// Singleton instance
export const openaiMock = new OpenAIMock();

// Vitest mock for OpenAI SDK
vi.mock('openai', () => ({
  default: {
    chat: vi.fn().mockResolvedValue({
      id: 'chatcmpl-123',
      object: 'chat.completion',
      choices: [{
        message: { role: 'assistant', content: 'Mocked response' },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    }),
    transcriptions: {
      create: vi.fn().mockResolvedValue({
        status: 'processing',
      }),
      retrieve: vi.fn().mockResolvedValue({
        status: 'succeeded',
        text: 'Mocked transcription',
      }),
    },
    audio: {
      speech: vi.fn().mockResolvedValue({
        id: 'speech-123',
        audio: 'base64encodedaudio',
      }),
    },
  },
}));
