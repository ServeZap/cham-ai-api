import { z } from 'zod';

export const ClawdTalkEventSchema = z.object({
  call_id: z.string(),
  text: z.string().optional(),
  timestamp: z.string(),
  sequence: z.number(),
  event: z.enum(['start', 'speech', 'speech_partial', 'end', 'error', 'hangup']),
  pin_verified: z.boolean().optional(),
  token: z.string().optional(),
});

export interface ClawdTalkResponse {
  type: 'response' | 'error' | 'hangup' | 'connected';
  call_id: string;
  text?: string;
  sequence?: number;
  error?: string;
  timestamp?: string;
}
