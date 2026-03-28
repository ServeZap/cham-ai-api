import { z } from 'zod';

export const CompleteSchema = z.object({
  prompt: z.string().min(1),
  session_id: z.string().uuid().optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export const ToolCallSchema = z.object({
  tool: z.string().min(1),
  parameters: z.record(z.string(), z.any()),
});
