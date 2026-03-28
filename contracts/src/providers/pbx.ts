import type { BaseProvider, ProviderResult } from './common.js';

export interface PBXExtension {
  extension: string;
  name: string;
  status: 'online' | 'offline' | 'busy' | 'ringing' | 'dnd';
  registeredAt?: string;
  ipAddress?: string;
}

export interface PBXQueue {
  id: string;
  name: string;
  strategy: 'ringall' | 'roundrobin' | 'leastrecent' | 'fewestcalls' | 'random';
  members: string[];
  waitingCalls: number;
  avgWaitSeconds: number;
}

export interface CDRRecord {
  id: string;
  callId: string;
  source: string;
  destination: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  disposition: string;
  cost?: number;
  recordingUrl?: string;
}

export interface TransferOptions {
  callId: string;
  destination: string;
  type: 'blind' | 'attended';
}

export interface PBXProvider extends BaseProvider {
  listExtensions(): Promise<ProviderResult<PBXExtension[]>>;
  getExtension(extension: string): Promise<ProviderResult<PBXExtension>>;
  listQueues(): Promise<ProviderResult<PBXQueue[]>>;
  transfer(options: TransferOptions): Promise<ProviderResult<void>>;
  hold(callId: string): Promise<ProviderResult<void>>;
  unhold(callId: string): Promise<ProviderResult<void>>;
  queryCDR(filters?: Record<string, unknown>): Promise<ProviderResult<CDRRecord[]>>;
  getRecording(recordingId: string): Promise<ProviderResult<string>>;
}
