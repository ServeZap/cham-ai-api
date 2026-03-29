import { describe, it, expect } from 'vitest';
import { estimateCost, buildUsageInsertSQL, type UsageRecord } from '../../../src/services/cost-tracker.js';

describe('Cost Tracker', () => {
  describe('estimateCost', () => {
    it('should estimate zero cost for empty usage', () => {
      const result = estimateCost({});
      expect(result).toEqual({
        stt_cost: 0,
        llm_cost: 0,
        tts_cost: 0,
        telephony_cost: 0,
        total_cost: 0,
      });
    });

    it('should estimate LLM cost for gpt-4o', () => {
      const result = estimateCost({
        tenant_id: 't1',
        llm_model: 'gpt-4o',
        llm_prompt_tokens: 1000,
        llm_completion_tokens: 500,
        llm_total_tokens: 1500,
      });

      // gpt-4o: $0.0025/1K prompt, $0.01/1K completion
      expect(result.llm_cost).toBeGreaterThan(0);
      expect(result.total_cost).toBe(result.llm_cost);
    });

    it('should estimate LLM cost for gpt-4o-mini (cheaper)', () => {
      const result4o = estimateCost({
        tenant_id: 't1',
        llm_model: 'gpt-4o',
        llm_prompt_tokens: 1000,
        llm_completion_tokens: 1000,
        llm_total_tokens: 2000,
      });

      const resultMini = estimateCost({
        tenant_id: 't1',
        llm_model: 'gpt-4o-mini',
        llm_prompt_tokens: 1000,
        llm_completion_tokens: 1000,
        llm_total_tokens: 2000,
      });

      expect(resultMini.llm_cost).toBeLessThan(result4o.llm_cost);
    });

    it('should estimate STT cost per second', () => {
      const result = estimateCost({
        tenant_id: 't1',
        stt_provider: 'whisper-1',
        stt_duration_ms: 30000, // 30 seconds
      });

      // whisper-1: $0.006/min = $0.0001/sec
      expect(result.stt_cost).toBeGreaterThan(0);
      expect(result.total_cost).toBe(result.stt_cost);
    });

    it('should estimate TTS cost per character', () => {
      const result = estimateCost({
        tenant_id: 't1',
        tts_provider: 'tts-1',
        tts_characters: 500,
      });

      // tts-1: $0.015/1K chars
      expect(result.tts_cost).toBeGreaterThan(0);
      expect(result.total_cost).toBe(result.tts_cost);
    });

    it('should estimate telephony cost per second', () => {
      const result = estimateCost({
        tenant_id: 't1',
        telephony_provider: 'twilio',
        telephony_duration_seconds: 60, // 1 minute
      });

      // twilio: ~$0.015/min
      expect(result.telephony_cost).toBeGreaterThan(0);
      expect(result.total_cost).toBe(result.telephony_cost);
    });

    it('should sum all cost components', () => {
      const result = estimateCost({
        tenant_id: 't1',
        llm_model: 'gpt-4o',
        llm_prompt_tokens: 100,
        llm_completion_tokens: 50,
        llm_total_tokens: 150,
        stt_provider: 'whisper-1',
        stt_duration_ms: 10000,
        tts_provider: 'tts-1',
        tts_characters: 200,
        telephony_provider: 'clawdtalk',
        telephony_duration_seconds: 30,
      });

      expect(result.stt_cost).toBeGreaterThan(0);
      expect(result.llm_cost).toBeGreaterThan(0);
      expect(result.tts_cost).toBeGreaterThan(0);
      expect(result.telephony_cost).toBeGreaterThan(0);
      expect(result.total_cost).toBeCloseTo(
        result.stt_cost + result.llm_cost + result.tts_cost + result.telephony_cost,
        6
      );
    });

    it('should use default rate for unknown provider', () => {
      const result = estimateCost({
        tenant_id: 't1',
        stt_provider: 'unknown-stt',
        stt_duration_ms: 10000,
      });

      expect(result.stt_cost).toBeGreaterThan(0);
    });
  });

  describe('buildUsageInsertSQL', () => {
    it('should build valid SQL with all fields', () => {
      const usage: UsageRecord = {
        tenant_id: 't1',
        call_id: 'call-1',
        session_id: 'sess-1',
        llm_provider: 'openclaw',
        llm_model: 'nadirclaw',
        llm_prompt_tokens: 100,
        llm_completion_tokens: 50,
        llm_total_tokens: 150,
        tool_calls_count: 2,
        tools_used: ['search', 'lookup'],
      };

      const costs = estimateCost(usage);
      const { sql, params } = buildUsageInsertSQL(usage, costs);

      expect(sql).toContain('INSERT INTO call_usage');
      expect(params).toHaveLength(22);
      expect(params[0]).toBe('t1');
      expect(params[1]).toBe('call-1');
      expect(params[2]).toBe('sess-1');
    });

    it('should handle null optional fields', () => {
      const usage: UsageRecord = {
        tenant_id: 't1',
      };

      const costs = estimateCost(usage);
      const { sql, params } = buildUsageInsertSQL(usage, costs);

      expect(params[1]).toBeNull(); // call_id
      expect(params[2]).toBeNull(); // session_id
    });
  });
});
