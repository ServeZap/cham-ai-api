import { z } from 'zod';

export const CreateConfigSchema = z.object({
  channel: z.enum(['webhook', 'email']),
  target: z.string().min(1),
  enabled: z.boolean().default(true),
});

export const ToggleConfigSchema = z.object({
  enabled: z.boolean(),
});

export const FailoverLogsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
});
