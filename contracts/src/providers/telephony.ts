import type { BaseProvider, ProviderResult, ProviderHealth } from './common.js';

/** Normalized telephony call event */
export interface TelephonyCallEvent {
  callId: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  status: 'ringing' | 'answered' | 'hangup' | 'failed' | 'busy';
  timestamp: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface OriginateOptions {
  from?: string;
  to: string;
  callerId?: string;
  timeout?: number;
  variables?: Record<string, string>;
}

export interface TelephonyProvider extends BaseProvider {
  /** Originate an outbound call */
  originate(options: OriginateOptions): Promise<ProviderResult<TelephonyCallEvent>>;
  /** Hang up an active call */
  hangup(callId: string): Promise<ProviderResult<void>>;
  /** Send SMS */
  sendSms(to: string, body: string, from?: string): Promise<ProviderResult<void>>;
  /** Normalize a raw provider event into TelephonyCallEvent */
  normalizeEvent(raw: Record<string, unknown>): TelephonyCallEvent | null;
}
