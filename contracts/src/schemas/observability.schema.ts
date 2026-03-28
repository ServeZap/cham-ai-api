import { z } from 'zod';

export const MetricsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

export const AlertHistoryQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(200),
});

export const ProviderJobsQuerySchema = z.object({
  page: z.coerce.number().min(0).default(0),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  provider_type: z.string().optional(),
  status: z.string().optional(),
});

export const HealthChecksQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(2000).default(500),
});
