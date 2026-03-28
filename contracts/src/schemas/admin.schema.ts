import { z } from 'zod';

export const GenerateApiKeySchema = z.object({
  label: z.string().min(1).default('AI Agent'),
});
