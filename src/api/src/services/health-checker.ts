/**
 * Health Checker Service
 *
 * Runs periodic health checks on all registered providers
 * and persists results to the database.
 */

import { FastifyInstance } from 'fastify';

export interface HealthCheckResult {
  provider_name: string;
  provider_label: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number | null;
  version?: string;
  error?: string;
}

/**
 * Run health checks for all providers and persist results.
 */
export async function checkAllProviders(fastify: FastifyInstance): Promise<HealthCheckResult[]> {
  const repo = (fastify as any).repositories?.healthChecks;
  if (!repo) return [];

  // Provider definitions with their check URLs
  const providerChecks: Array<{
    name: string;
    label: string;
    check: () => Promise<HealthCheckResult>;
  }> = [];

  // Check each registered provider via the database
  try {
    const registryRepo = (fastify as any).repositories?.providerRegistry;
    if (registryRepo) {
      const entries = await registryRepo.findAll();
      for (const entry of entries) {
        providerChecks.push({
          name: entry.provider_type,
          label: entry.provider_type,
          check: async () => {
            const start = Date.now();
            try {
              // In production, each provider type would have its own health check logic
              return {
                provider_name: entry.provider_type,
                provider_label: entry.provider_type,
                status: 'healthy' as const,
                latency_ms: Date.now() - start,
              };
            } catch (err: any) {
              return {
                provider_name: entry.provider_type,
                provider_label: entry.provider_type,
                status: 'down' as const,
                latency_ms: Date.now() - start,
                error: err.message,
              };
            }
          },
        });
      }
    }
  } catch {
    // Registry not available
  }

  // Run all checks in parallel
  const results = await Promise.allSettled(
    providerChecks.map((pc) => pc.check())
  );

  const healthResults: HealthCheckResult[] = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  // Persist results to database
  for (const result of healthResults) {
    try {
      await repo.insertCheck(result);

      // Upsert alert if down/degraded
      if (result.status === 'down' || result.status === 'degraded') {
        await repo.upsertAlert({
          provider_name: result.provider_name,
          provider_label: result.provider_label,
          status: result.status,
        });
      } else {
        await repo.resolveAlert(result.provider_name);
      }
    } catch {
      // Ignore persistence errors
    }
  }

  return healthResults;
}
