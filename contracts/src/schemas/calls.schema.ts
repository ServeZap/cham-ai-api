import { z } from 'zod';

export const OutboundCallSchema = z.object({
  phone_number: z.string().min(10),
  assistant_id: z.string().uuid(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const InboundCallSchema = z.object({
  CallSid: z.string().optional(),
  From: z.string().optional(),
  To: z.string().optional(),
});

export const ListCallsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export const OverviewSchema = z.object({
  since: z.string().min(1),
  until: z.string().optional(),
});

export const TranscriptSchema = z.object({
  call_id: z.string().min(1),
  transcript_text: z.string().min(1),
  language: z.string().optional(),
  segments: z.any().optional(),
  confidence: z.number().nullable().optional(),
});

export const CDRQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  offset: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(1000).default(1000),
});
