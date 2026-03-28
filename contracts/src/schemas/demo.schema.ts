import { z } from 'zod';

export const DemoRequestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(20).nullable().optional(),
  company: z.string().max(100).nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
});
