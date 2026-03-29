import { z } from 'zod';

export const UsageQuerySchema = z.object({
  since: z.string().optional(),
  until: z.string().optional(),
  granularity: z.enum(['hour', 'day', 'month']).default('day'),
  groupBy: z.enum(['tenant', 'service', 'provider']).default('tenant'),
});

export const TenantLimitsSchema = z.object({
  max_minutes_per_day: z.number().int().min(0).optional(),
  max_tokens_per_day: z.number().int().min(0).optional(),
  max_cost_per_day: z.number().min(0).optional(),
  max_concurrent_calls: z.number().int().min(1).optional(),
  currency: z.string().length(3).optional(),
});

export const CostCheckSchema = z.object({
  estimated_minutes: z.number().int().min(0).default(0),
  estimated_tokens: z.number().int().min(0).default(0),
  estimated_cost: z.number().min(0).default(0),
});

export const CallUsageSchema = z.object({
  call_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  stt_provider: z.string().optional(),
  stt_duration_ms: z.number().int().optional(),
  stt_tokens: z.number().int().optional(),
  llm_provider: z.string().optional(),
  llm_model: z.string().optional(),
  llm_prompt_tokens: z.number().int().optional(),
  llm_completion_tokens: z.number().int().optional(),
  llm_total_tokens: z.number().int().optional(),
  tts_provider: z.string().optional(),
  tts_characters: z.number().int().optional(),
  telephony_provider: z.string().optional(),
  telephony_duration_seconds: z.number().int().optional(),
  stt_cost: z.number().optional(),
  llm_cost: z.number().optional(),
  tts_cost: z.number().optional(),
  telephony_cost: z.number().optional(),
  tool_calls_count: z.number().int().optional(),
  tools_used: z.array(z.string()).optional(),
});
