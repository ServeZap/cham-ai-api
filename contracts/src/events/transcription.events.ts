export type TranscriptionEventType = 'transcription.partial' | 'transcription.final';

export interface TranscriptionPayload {
  text: string;
  language?: string;
  confidence?: number;
  segments?: TranscriptionSegmentPayload[];
}

export interface TranscriptionSegmentPayload {
  text: string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
}

export interface TranscriptionEvent {
  type: TranscriptionEventType;
  tenantId: string;
  callId: string;
  payload: TranscriptionPayload;
  timestamp: string;
}
