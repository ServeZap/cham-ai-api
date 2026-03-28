import { z } from 'zod';

/** Pagination query — reused by list endpoints */
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

/** Extended pagination with larger limit */
export const LargePaginationSchema = PaginationSchema.extend({
  limit: z.coerce.number().min(1).max(1000).default(100),
});

/** Date range filter */
export const DateRangeSchema = z.object({
  since: z.string().min(1).optional(),
  until: z.string().optional(),
});

/** CDR date range (uses dateFrom/dateTo naming) */
export const CDRDateRangeSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

/** Common query limit with upper bound */
export function limitSchema(max: number, defaultVal: number) {
  return z.coerce.number().min(1).max(max).default(defaultVal);
}
