/**
 * Cham.ai Contracts v1
 *
 * Versioned schemas, domain events, and provider contracts.
 * Single source of truth for all API validation and type definitions.
 *
 * Usage (backend):
 *   import { ConverseSchema } from '../../contracts/src/index.js';
 *
 * Usage (types only):
 *   import type { TelephonyProvider } from '../../contracts/src/index.js';
 */

// ── Shared Types ──────────────────────────────────────────────────────
export type {
  PaginationQuery,
  PaginatedResponse,
  DateRangeQuery,
  Auditable,
  TenantScoped,
  ApiError,
} from './shared/index.js';

// ── Domain Events ───────────────────────────────────────────────────
export type {
  CallEvent,
  CallEventType,
  CallEventPayload,
} from './events/call.events.js';

export type {
  TranscriptionEvent,
  TranscriptionEventType,
  TranscriptionPayload,
  TranscriptionSegmentPayload,
} from './events/transcription.events.js';

export type {
  HealthEvent,
  HealthEventType,
  HealthCheckPayload,
  FailoverPayload,
} from './events/health.events.js';

// ── Zod API Schemas ──────────────────────────────────────────────────
export {
  PaginationSchema,
  LargePaginationSchema,
  DateRangeSchema,
  CDRDateRangeSchema,
  limitSchema,
} from './schemas/shared.schema.js';

export {
  OutboundCallSchema,
  InboundCallSchema,
  ListCallsSchema,
  OverviewSchema,
  TranscriptSchema,
  CDRQuerySchema,
} from './schemas/calls.schema.js';

export { ConverseSchema } from './schemas/voice.schema.js';

export {
  CreateSessionSchema,
  UpdateSessionSchema,
  ListSessionsSchema,
} from './schemas/sessions.schema.js';

export {
  CompleteSchema,
  ToolCallSchema,
} from './schemas/ai.schema.js';

export {
  MetricsQuerySchema,
  AlertHistoryQuerySchema,
  ProviderJobsQuerySchema,
  HealthChecksQuerySchema,
} from './schemas/observability.schema.js';

export {
  CreateConfigSchema,
  ToggleConfigSchema,
  FailoverLogsQuerySchema,
} from './schemas/failover.schema.js';

export { DemoRequestSchema } from './schemas/demo.schema.js';

export { GenerateApiKeySchema } from './schemas/admin.schema.js';

export {
  SignedUrlSchema,
  SignedUrlsSchema,
} from './schemas/storage.schema.js';

export {
  ClawdTalkEventSchema,
} from './schemas/clawdtalk.schema.js';

export type { ClawdTalkResponse } from './schemas/clawdtalk.schema.js';

// ── Provider Contracts ────────────────────────────────────────────────
export type {
  ProviderResult,
  ProviderHealth,
  BaseProvider,
} from './providers/common.js';

export type {
  TelephonyProvider,
  TelephonyCallEvent,
  OriginateOptions,
} from './providers/telephony.js';

export type {
  SpeechProvider,
  TranscriptionSegment,
  TranscriptionResult,
  TranscribeOptions,
  SynthesizeOptions,
} from './providers/speech.js';

export type {
  AgentEngine,
  ToolCall,
  ToolResult,
  AgentMessage,
  AgentResponse,
  AgentUsage,
  AgentSessionOptions,
} from './providers/agent-engine.js';

export type {
  UIExecutor,
  MissionStatus,
  MissionStep,
  Mission,
  CreateMissionOptions,
} from './providers/ui-executor.js';

export type {
  PBXProvider,
  PBXExtension,
  PBXQueue,
  CDRRecord,
  TransferOptions,
} from './providers/pbx.js';

export type {
  TelecomBillingProvider,
  BillingCDRRecord,
  BillingSyncOptions,
  BillingSyncResult,
} from './providers/billing.js';

export type {
  IntegrationAdapter,
  IntegrationAction,
  IntegrationRequest,
  IntegrationResponse,
} from './providers/integration.js';
