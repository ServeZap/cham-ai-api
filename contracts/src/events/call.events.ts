export type CallEventType =
  | 'call.created'
  | 'call.updated'
  | 'call.status_changed'
  | 'call.ended';

export interface CallEventPayload {
  /** Call status */
  status?: string;
  /** Caller number */
  caller_number?: string;
  /** Receiver ID */
  receiver_id?: string;
  /** Call direction */
  direction?: 'inbound' | 'outbound';
  /** Duration in seconds */
  duration_seconds?: number;
  /** Call outcome */
  outcome?: string;
  /** Cost */
  cost?: number;
  /** STT latency */
  stt_latency_ms?: number;
  /** Tool used by AI */
  tool_used?: string;
  /** Campaign ID */
  campaign_id?: string;
}

export interface CallEvent {
  type: CallEventType;
  tenantId: string;
  callId: string;
  payload: CallEventPayload;
  timestamp: string;
}
