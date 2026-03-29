/**
 * Cost Tracker Service
 *
 * Tracks AI/telephony usage per call and per tenant.
 * Provides cost estimation, limit checking, and usage aggregation.
 *
 * Cost governance is a PRODUCT FEATURE — every LLM/STT/TTS call
 * should be tracked here.
 */

// ── Cost Per Unit (USD) ──────────────────────────────────────────────
// These are the rates used for cost estimation. They should match
// actual provider pricing and can be overridden per-tenant.

const COST_RATES = {
  // LLM models (per 1K tokens)
  llm: {
    'gpt-4o': { prompt: 0.0025, completion: 0.01 },
    'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
    'nadirclaw': { prompt: 0.0025, completion: 0.01 }, // OpenClaw default
  },
  // STT (per second)
  stt: {
    'whisper-1': 0.0001,       // $0.006/min
    'faster-whisper': 0.00005,  // Self-hosted, cheaper
    'deepgram': 0.000083,       // $0.005/min
  },
  // TTS (per character)
  tts: {
    'tts-1': 0.000015,         // $0.015/1K chars
    'tts-1-hd': 0.00003,       // $0.030/1K chars
    'elevenlabs': 0.00003,     // ~$0.03/1K chars
  },
  // Telephony (per second)
  telephony: {
    'clawdtalk': 0.000167,     // ~$0.01/min
    'twilio': 0.00025,         // ~$0.015/min
  },
} as const;

export interface UsageRecord {
  tenant_id: string;
  call_id?: string;
  session_id?: string;
  stt_provider?: string;
  stt_duration_ms?: number;
  stt_tokens?: number;
  llm_provider?: string;
  llm_model?: string;
  llm_prompt_tokens?: number;
  llm_completion_tokens?: number;
  llm_total_tokens?: number;
  tts_provider?: string;
  tts_characters?: number;
  telephony_provider?: string;
  telephony_duration_seconds?: number;
  tool_calls_count?: number;
  tools_used?: string[];
}

export interface CostBreakdown {
  stt_cost: number;
  llm_cost: number;
  tts_cost: number;
  telephony_cost: number;
  total_cost: number;
}

/**
 * Estimate cost for a usage record based on current rates.
 * Accepts partial usage (tenant_id not needed for estimation).
 */
export function estimateCost(usage: Partial<UsageRecord>): CostBreakdown {
  let stt_cost = 0;
  let llm_cost = 0;
  let tts_cost = 0;
  let telephony_cost = 0;

  // STT cost (per second)
  if (usage.stt_provider && usage.stt_duration_ms) {
    const seconds = usage.stt_duration_ms / 1000;
    const rate = COST_RATES.stt[usage.stt_provider as keyof typeof COST_RATES.stt] ?? 0.0001;
    stt_cost = seconds * rate;
  }

  // LLM cost (per 1K tokens)
  if (usage.llm_model && usage.llm_total_tokens) {
    const modelRates = COST_RATES.llm[usage.llm_model as keyof typeof COST_RATES.llm];
    if (modelRates) {
      const promptCost = ((usage.llm_prompt_tokens ?? 0) / 1000) * modelRates.prompt;
      const completionCost = ((usage.llm_completion_tokens ?? 0) / 1000) * modelRates.completion;
      llm_cost = promptCost + completionCost;
    }
  }

  // TTS cost (per character)
  if (usage.tts_provider && usage.tts_characters) {
    const rate = COST_RATES.tts[usage.tts_provider as keyof typeof COST_RATES.tts] ?? 0.000015;
    tts_cost = usage.tts_characters * rate;
  }

  // Telephony cost (per second)
  if (usage.telephony_provider && usage.telephony_duration_seconds) {
    const rate = COST_RATES.telephony[usage.telephony_provider as keyof typeof COST_RATES.telephony] ?? 0.000167;
    telephony_cost = usage.telephony_duration_seconds * rate;
  }

  return {
    stt_cost: roundCost(stt_cost),
    llm_cost: roundCost(llm_cost),
    tts_cost: roundCost(tts_cost),
    telephony_cost: roundCost(telephony_cost),
    total_cost: roundCost(stt_cost + llm_cost + tts_cost + telephony_cost),
  };
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Build the SQL to insert a call_usage record.
 */
export function buildUsageInsertSQL(usage: UsageRecord, costs: CostBreakdown): {
  sql: string;
  params: any[];
} {
  const sql = `
    INSERT INTO call_usage (
      tenant_id, call_id, session_id,
      stt_provider, stt_duration_ms, stt_tokens,
      llm_provider, llm_model, llm_prompt_tokens, llm_completion_tokens, llm_total_tokens,
      tts_provider, tts_characters,
      telephony_provider, telephony_duration_seconds,
      stt_cost, llm_cost, tts_cost, telephony_cost, total_cost,
      tool_calls_count, tools_used
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13,
      $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22
    )
    RETURNING id, total_cost
  `;

  const params = [
    usage.tenant_id,
    usage.call_id || null,
    usage.session_id || null,
    usage.stt_provider || null,
    usage.stt_duration_ms || null,
    usage.stt_tokens || null,
    usage.llm_provider || null,
    usage.llm_model || null,
    usage.llm_prompt_tokens || 0,
    usage.llm_completion_tokens || 0,
    usage.llm_total_tokens || 0,
    usage.tts_provider || null,
    usage.tts_characters || null,
    usage.telephony_provider || null,
    usage.telephony_duration_seconds || null,
    costs.stt_cost,
    costs.llm_cost,
    costs.tts_cost,
    costs.telephony_cost,
    costs.total_cost,
    usage.tool_calls_count || 0,
    usage.tools_used ? JSON.stringify(usage.tools_used) : '[]',
  ];

  return { sql, params };
}
