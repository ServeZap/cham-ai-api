/** Generic async result wrapper — all providers return this */
export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/** Health check response */
export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number | null;
  provider: string;
  version?: string;
  details?: Record<string, unknown>;
}

/** Base interface all providers must implement */
export interface BaseProvider {
  /** Provider name (e.g. 'clawdtalk', 'whisper') */
  name: string;
  /** Check provider health — called by monitoring */
  healthCheck(): Promise<ProviderHealth>;
}
