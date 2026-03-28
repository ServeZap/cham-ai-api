import type { BaseProvider, ProviderResult } from './common.js';

export type IntegrationAction =
  | 'create_lead'
  | 'open_incident'
  | 'attach_evidence'
  | 'notify_contact';

export interface IntegrationRequest {
  action: IntegrationAction;
  tenantId: string;
  callId?: string;
  payload: Record<string, unknown>;
}

export interface IntegrationResponse {
  ok: boolean;
  action: IntegrationAction;
  externalId?: string;
  provider: string;
  message: string;
}

export interface IntegrationAdapter extends BaseProvider {
  execute(request: IntegrationRequest): Promise<ProviderResult<IntegrationResponse>>;
}
