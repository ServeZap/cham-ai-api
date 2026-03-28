export type { ProviderResult, ProviderHealth, BaseProvider } from './common.js';

export type { TelephonyProvider, TelephonyCallEvent, OriginateOptions } from './telephony.js';
export type { SpeechProvider, TranscriptionSegment, TranscriptionResult, TranscribeOptions, SynthesizeOptions } from './speech.js';
export type { AgentEngine, ToolCall, ToolResult, AgentMessage, AgentResponse, AgentUsage, AgentSessionOptions } from './agent-engine.js';
export type { UIExecutor, MissionStatus, MissionStep, Mission, CreateMissionOptions } from './ui-executor.js';
export type { PBXProvider, PBXExtension, PBXQueue, CDRRecord, TransferOptions } from './pbx.js';
export type { TelecomBillingProvider, BillingCDRRecord, BillingSyncOptions, BillingSyncResult } from './billing.js';
export type { IntegrationAdapter, IntegrationAction, IntegrationRequest, IntegrationResponse } from './integration.js';
