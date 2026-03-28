import type { BaseProvider, ProviderResult } from './common.js';

/** Single transcription segment from STT */
export interface TranscriptionSegment {
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
}

/** STT result */
export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  durationMs: number;
  segments?: TranscriptionSegment[];
}

export interface TranscribeOptions {
  language?: string;
  format?: string;
  model?: string;
  punctuate?: boolean;
}

export interface SynthesizeOptions {
  text: string;
  voice?: string;
  speed?: number;
  outputFormat?: 'wav' | 'mp3' | 'ogg';
}

export interface SpeechProvider extends BaseProvider {
  /** Speech-to-text */
  transcribe(audio: Buffer | string, options?: TranscribeOptions): Promise<ProviderResult<TranscriptionResult>>;
  /** Text-to-speech */
  synthesize(options: SynthesizeOptions): Promise<ProviderResult<Buffer>>;
}
