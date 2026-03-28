import type { BaseProvider, ProviderResult } from './common.js';

export type MissionStatus = 'queued' | 'running' | 'done' | 'failed' | 'needs_takeover';

export interface MissionStep {
  index: number;
  action: string;
  selector?: string;
  value?: string;
  status: MissionStatus;
  screenshot?: string;
  error?: string;
  durationMs?: number;
}

export interface Mission {
  id: string;
  description: string;
  targetUrl: string;
  status: MissionStatus;
  steps: MissionStep[];
  progress: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface CreateMissionOptions {
  description: string;
  targetUrl: string;
  credentialId?: string;
  timeout?: number;
  allowTakeover?: boolean;
}

export interface UIExecutor extends BaseProvider {
  createMission(options: CreateMissionOptions): Promise<ProviderResult<Mission>>;
  getMission(missionId: string): Promise<ProviderResult<Mission>>;
  listMissionIds(): Promise<ProviderResult<string[]>>;
  pauseMission(missionId: string): Promise<ProviderResult<void>>;
  resumeMission(missionId: string): Promise<ProviderResult<void>>;
  cancelMission(missionId: string): Promise<ProviderResult<void>>;
  captureScreenshot(missionId: string, stepIndex?: number): Promise<ProviderResult<string>>;
}
