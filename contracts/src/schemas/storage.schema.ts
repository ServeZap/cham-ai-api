import { z } from 'zod';

export const SignedUrlSchema = z.object({
  path: z.string().min(1, 'Path é obrigatório'),
  expiresIn: z.number().int().min(1).max(86400).default(3600),
});

export const SignedUrlsSchema = z.object({
  paths: z.array(z.string().min(1)).min(1, 'Paths é obrigatório'),
  expiresIn: z.number().int().min(1).max(86400).default(3600),
});
