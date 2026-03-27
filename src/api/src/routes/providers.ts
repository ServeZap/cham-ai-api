/**
 * Providers Routes
 *
 * Provider registry management and health checks.
 *
 * @route GET  /api/v1/providers/registry    - List all provider registry entries
 * @route PUT  /api/v1/providers/registry/:type - Upsert provider for a layer
 * @route GET  /api/v1/providers/health      - Health check all providers
 * @route POST /api/v1/providers/health-sync - Sync provider health statuses
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const UpsertProviderSchema = z.object({
  active_provider: z.string().min(1),
  config: z.record(z.any()).optional(),
});

export async function providersRoutes(fastify: FastifyInstance) {
  // List provider registry
  fastify.get('/registry', async (request, reply) => {
    const repo = (fastify as any).repositories.providerRegistry;
    const entries = await repo.findAll();
    return { entries };
  });

  // Upsert provider for a layer
  fastify.put<{ Params: { type: string } }>(
    '/registry/:type',
    async (request, reply) => {
      const { type } = request.params;
      const data = UpsertProviderSchema.parse(request.body);

      // Get tenant_id from JWT
      const jwtPayload = (request as any).user || {};
      const userId = jwtPayload.sub;
      const repo = (fastify as any).repositories.providerRegistry;

      if (!userId) {
        return reply.status(401).send({ error: 'User ID not found in token', code: 'UNAUTHORIZED' });
      }

      // Get tenant_id from profiles
      const tenantId = await repo.getTenantId(userId);
      if (!tenantId) {
        return reply.status(400).send({ error: 'Tenant not found', code: 'TENANT_NOT_FOUND' });
      }

      const entry = await repo.upsert(tenantId, type, data.active_provider, data.config);
      return { entry };
    }
  );

  // Health check all providers (aggregated from DB + live)
  fastify.get('/health', async (request, reply) => {
    const repo = (fastify as any).repositories.healthChecks;
    const recent = await repo.findRecent(
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // last 2 hours
      100
    );

    // Group by provider, get latest check
    const latestByProvider = new Map<string, any>();
    for (const check of recent) {
      const existing = latestByProvider.get(check.provider_name);
      if (!existing || new Date(check.check_timestamp) > new Date(existing.check_timestamp)) {
        latestByProvider.set(check.provider_name, check);
      }
    }

    const providers = Array.from(latestByProvider.entries()).map(([name, check]) => ({
      name,
      label: check.provider_label || name,
      status: check.status,
      latencyMs: check.latency_ms,
      version: check.version,
      lastChecked: check.check_timestamp,
      error: check.error,
    }));

    const overallStatus = providers.every((p) => p.status === 'healthy')
      ? 'healthy'
      : providers.some((p) => p.status === 'down')
      ? 'down'
      : 'degraded';

    return { providers, overallStatus };
  });

  // Sync provider health (save check results to DB)
  fastify.post('/health-sync', async (request, reply) => {
    const body = request.body as any;
    const providers = body?.providers as Array<{
      name: string;
      label: string;
      status: string;
      latencyMs: number | null;
      version?: string;
      error?: string;
    }>;

    if (!providers || !Array.isArray(providers)) {
      return reply.status(400).send({ error: 'providers array is required', code: 'VALIDATION_ERROR' });
    }

    const repo = (fastify as any).repositories.healthChecks;

    for (const p of providers) {
      await repo.insertCheck({
        provider_name: p.name,
        provider_label: p.label,
        status: p.status,
        latency_ms: p.latencyMs,
        version: p.version,
        error: p.error,
      });

      // Upsert alert if down/degraded
      if (p.status === 'down' || p.status === 'degraded') {
        await repo.upsertAlert({
          provider_name: p.name,
          provider_label: p.label,
          status: p.status,
        });
      } else {
        await repo.resolveAlert(p.name);
      }
    }

    // Return updated alerts
    const alerts = await repo.findAlerts();
    return { synced: providers.length, alerts };
  });
}
