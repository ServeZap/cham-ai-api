import { z } from 'zod';

export const ConverseSchema = z.object({
  assistant_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  audio: z.string().optional(),
  text: z.string().optional(),
});
