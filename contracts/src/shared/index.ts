/** Pagination query parameters (reused across multiple endpoints) */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/** Time range filter */
export interface DateRangeQuery {
  since?: string;
  until?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Audit fields present on all tenant-scoped records */
export interface Auditable {
  created_at: string;
  updated_at?: string;
}

/** Multi-tenant base fields */
export interface TenantScoped {
  tenant_id: string;
}

/** API error response shape */
export interface ApiError {
  error: string;
  code: string;
}
