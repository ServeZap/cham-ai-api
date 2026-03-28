export type HealthEventType = 'health.check' | 'health.degraded' | 'health.restored' | 'failover.triggered';

export interface HealthCheckPayload {
  provider_name: string;
  provider_label?: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number | null;
  error: string | null;
  check_timestamp: string;
}

export interface FailoverPayload {
  provider_type: string;
  failed_provider: string;
  active_provider: string;
  failover_chain: string[];
  failed_providers: { name: string; reason: string }[];
  gpu_failure: boolean;
  action_path: string | null;
}

export interface HealthEvent {
  type: HealthEventType;
  tenantId: string;
  callId?: string;
  payload: HealthCheckPayload | FailoverPayload;
  timestamp: string;
}
