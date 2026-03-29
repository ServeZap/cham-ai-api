-- Cham.ai Cost Governance Schema
-- Per-call and per-tenant usage tracking with daily limits
-- Version: 0.2.0

-- ── Tenant Usage Limits ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    max_minutes_per_day INTEGER DEFAULT 60,
    max_tokens_per_day INTEGER DEFAULT 100000,
    max_cost_per_day DECIMAL(10, 2) DEFAULT 10.00,
    max_concurrent_calls INTEGER DEFAULT 5,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usage Tracking (per-call granularity) ────────────────────────────
CREATE TABLE IF NOT EXISTS call_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,

    -- STT usage
    stt_provider VARCHAR(50),
    stt_duration_ms INTEGER,
    stt_tokens INTEGER,

    -- LLM usage
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    llm_prompt_tokens INTEGER DEFAULT 0,
    llm_completion_tokens INTEGER DEFAULT 0,
    llm_total_tokens INTEGER DEFAULT 0,

    -- TTS usage
    tts_provider VARCHAR(50),
    tts_characters INTEGER,

    -- Telephony usage
    telephony_provider VARCHAR(50),
    telephony_duration_seconds INTEGER,

    -- Aggregated cost
    stt_cost DECIMAL(10, 6) DEFAULT 0,
    llm_cost DECIMAL(10, 6) DEFAULT 0,
    tts_cost DECIMAL(10, 6) DEFAULT 0,
    telephony_cost DECIMAL(10, 6) DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,

    -- Tool usage
    tool_calls_count INTEGER DEFAULT 0,
    tools_used JSONB DEFAULT '[]',

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_usage_tenant_id ON call_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_usage_call_id ON call_usage(call_id);
CREATE INDEX IF NOT EXISTS idx_call_usage_created_at ON call_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_usage_tenant_date ON call_usage(
    tenant_id, (created_at::date)
);

-- ── Daily Usage Summary (materialized daily) ─────────────────────────
CREATE TABLE IF NOT EXISTS daily_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,

    total_calls INTEGER DEFAULT 0,
    total_minutes DECIMAL(10, 2) DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,

    stt_cost DECIMAL(10, 4) DEFAULT 0,
    llm_cost DECIMAL(10, 4) DEFAULT 0,
    tts_cost DECIMAL(10, 4) DEFAULT 0,
    telephony_cost DECIMAL(10, 4) DEFAULT 0,

    calls_inbound INTEGER DEFAULT 0,
    calls_outbound INTEGER DEFAULT 0,
    calls_failed INTEGER DEFAULT 0,

    avg_duration_seconds INTEGER DEFAULT 0,
    unique_callers INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_tenant_date ON daily_usage(tenant_id, date DESC);

-- ── Triggers ──────────────────────────────────────────────────────────
CREATE TRIGGER update_tenant_limits_updated_at BEFORE UPDATE ON tenant_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_usage_updated_at BEFORE UPDATE ON daily_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE tenant_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_limits_isolation ON tenant_limits
    FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id')::uuid));

CREATE POLICY call_usage_isolation ON call_usage
    FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id')::uuid));

CREATE POLICY daily_usage_isolation ON daily_usage
    FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id')::uuid));

-- ── Helper: Check if tenant has exceeded daily limits ─────────────────
CREATE OR REPLACE FUNCTION check_tenant_limits(
    p_tenant_id UUID,
    p_minutes INTEGER DEFAULT 0,
    p_tokens INTEGER DEFAULT 0,
    p_cost DECIMAL DEFAULT 0
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    current_minutes INTEGER,
    max_minutes INTEGER,
    current_tokens BIGINT,
    max_tokens INTEGER,
    current_cost DECIMAL,
    max_cost DECIMAL
) AS $$
DECLARE
    v_limits RECORD;
    v_today DATE := CURRENT_DATE;
    v_usage RECORD;
BEGIN
    -- Get tenant limits (default if none set)
    SELECT * INTO v_limits FROM tenant_limits WHERE tenant_id = p_tenant_id;
    IF NOT FOUND THEN
        v_limits.max_minutes_per_day := 60;
        v_limits.max_tokens_per_day := 100000;
        v_limits.max_cost_per_day := 10.00;
    END IF;

    -- Get today's usage
    SELECT
        COALESCE(SUM(telephony_duration_seconds), 0) / 60::INTEGER AS minutes,
        COALESCE(SUM(llm_total_tokens), 0)::BIGINT AS tokens,
        COALESCE(SUM(total_cost), 0) AS cost
    INTO v_usage
    FROM call_usage
    WHERE tenant_id = p_tenant_id
      AND created_at::date = v_today;

    -- Check each limit
    allowed := TRUE;
    reason := NULL;

    IF v_usage.minutes + p_minutes > v_limits.max_minutes_per_day THEN
        allowed := FALSE;
        reason := 'Daily minutes limit exceeded';
    ELSIF v_usage.tokens + p_tokens > v_limits.max_tokens_per_day THEN
        allowed := FALSE;
        reason := 'Daily tokens limit exceeded';
    ELSIF v_usage.cost + p_cost > v_limits.max_cost_per_day THEN
        allowed := FALSE;
        reason := 'Daily cost limit exceeded';
    END IF;

    RETURN QUERY SELECT
        allowed,
        reason,
        v_usage.minutes,
        v_limits.max_minutes_per_day,
        v_usage.tokens,
        v_limits.max_tokens_per_day,
        v_usage.cost,
        v_limits.max_cost_per_day;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Default limits for the internal tenant ───────────────────────────
INSERT INTO tenant_limits (tenant_id, max_minutes_per_day, max_tokens_per_day, max_cost_per_day, max_concurrent_calls)
VALUES ('00000000-0000-0000-0000-000000000001', 1000, 5000000, 100.00, 50)
ON CONFLICT (tenant_id) DO NOTHING;
