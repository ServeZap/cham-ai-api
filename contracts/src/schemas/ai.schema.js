import { z } from 'zod';
export const CompleteSchema = z.object({
    prompt: z.string().min(1),
    session_id: z.string().uuid().optional(),
    context: z.record(z.string(), z.any()).optional(),
});
export const ToolCallSchema = z.object({
    tool: z.string().min(1),
    parameters: z.record(z.string(), z.any()),
    tool_call_id: z.string().optional(),
    session_id: z.string().uuid().optional(),
    messages: z.array(z.record(z.string(), z.any())).optional(),
});
