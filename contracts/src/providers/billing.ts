import type { BaseProvider, ProviderResult } from './common.js';

export interface BillingCDRRecord {
  callId: string;
  tenantId: string;
  destination: string;
  durationSeconds: number;
  cost: number;
  currency: string;
  trunk: string;
  ratedAt: string;
}

export interface BillingSyncOptions {
  tenantId: string;
  dateFrom?: string;
  dateTo?: string;
  provider?: 'magnusbilling' | 'portaone' | 'custom';
}

export interface BillingSyncResult {
  ok: boolean;
  tenantId: string;
  provider: string;
  recordsSynced: number;
  message: string;
}

export interface TelecomBillingProvider extends BaseProvider {
  syncCDRs(options: BillingSyncOptions): Promise<ProviderResult<BillingSyncResult>>;
}
