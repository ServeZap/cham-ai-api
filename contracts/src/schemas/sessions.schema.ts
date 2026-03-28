import { z } from 'zod';

export const CreateSessionSchema = z.object({
  assistant_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const UpdateSessionSchema = z.object({
  status: z.string().optional(),
  context: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const ListSessionsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  assistant_id: z.string().uuid().optional(),
  status: z.string().optional(),
});
