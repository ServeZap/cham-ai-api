# ARCHITECTURE - Cham.ai

System architecture for the Cham.ai Voice AI Platform.

---

## Overview

Cham.ai is a real-time Voice AI Platform that enables AI-powered voice agents for business communications. The platform handles both inbound and outbound calls, providing natural language understanding, speech processing, and conversational AI capabilities.

**Core Architecture Philosophy:**
- Real-time latency <500ms for conversational flow
- Scalable to thousands of concurrent calls
- Multi-tenant isolation and security
- Provider-agnostic AI integration
- Cost-optimized token usage

---

## System Components

### 1. Runtime Services (9 Services)

#### 1.1 Voice Agent Service
**Purpose:** Core conversational AI orchestration for voice interactions

**Responsibilities:**
- Manage conversation state and context
- Coordinate between STT, LLM, and TTS
- Handle conversation flow and turns
- Maintain conversation memory (short and long-term)
- Implement conversation strategies (SDR, support, emergency)

**Tech Stack:**
- Node.js + Fastify (real-time websockets)
- Redis for session state
- PostgreSQL for conversation persistence

**Performance:**
- Target: <100ms orchestration latency
- State synchronization: <50ms
- Context window: 32k tokens (flexible)

#### 1.2 Call Management Service
**Purpose:** Telephony integration and call lifecycle management

**Responsibilities:**
- Inbound call handling and routing
- Outbound call initiation and queueing
- Call state management (ringing, active, ended)
- SIP/WebRTC signaling
- Call recording and storage
- Phone number management

**Tech Stack:**
- SIP server (Asterisk, Kamailio, or Twilio SDK)
- WebRTC for browser-based calls
- PostgreSQL for call records
- S3-compatible storage for recordings

**Integrations:**
- Twilio (primary)
- Plivo (backup)
- Custom SIP trunks (enterprise)

#### 1.3 Session Management Service
**Purpose:** Multi-tenant session orchestration and lifecycle

**Responsibilities:**
- Tenant isolation and authentication
- Session creation, termination, and cleanup
- Resource allocation per tenant
- Concurrent session limits
- Session state synchronization

**Tech Stack:**
- Node.js + Fastify
- Redis for active sessions
- PostgreSQL for session history
- JWT authentication

**Security:**
- Tenant data isolation
- API rate limiting per tenant
- Session encryption

#### 1.4 Real-time Transcription Service
**Purpose:** Convert speech to text in real-time with low latency

**Responsibilities:**
- Audio stream ingestion (WebRTC, telephony)
- STT processing (streaming or batch)
- VAD (Voice Activity Detection)
- Speaker diarization (optional)
- Latency optimization

**Tech Stack:**
- OpenAI Whisper API (streaming)
- ElevenLabs STT (backup)
- Websocket audio streaming

**Performance:**
- Target: <2s latency from speech to text
- Accuracy: >95% for clear speech
- Support multiple languages (English, Portuguese, Spanish)

#### 1.5 Real-time Synthesis Service
**Purpose:** Convert text responses to natural speech in real-time

**Responsibilities:**
- TTS processing (streaming or batch)
- Voice selection and customization
- Prosody control (speed, pitch, emphasis)
- Audio format optimization

**Tech Stack:**
- OpenAI TTS API
- ElevenLabs TTS (backup, higher quality)
- Audio streaming via WebRTC

**Performance:**
- Target: <1s latency from text to speech
- Quality: Natural, human-like
- Custom voices per tenant

#### 1.6 Context Management Service
**Purpose:** Maintain conversation context across turns and sessions

**Responsibilities:**
- Short-term context (current call)
- Long-term context (customer history)
- Context summarization (token management)
- Context retrieval (vector search)
- Entity extraction and tracking

**Tech Stack:**
- Node.js + Fastify
- Redis for active context
- PostgreSQL for persistent context
- Pinecone for vector search (embeddings)

**Optimization:**
- Automatic context pruning (keep relevant tokens)
- Retrieval Augmented Generation (RAG)
- Entity resolution and linking

#### 1.7 Analytics Service
**Purpose:** Track and analyze call metrics and outcomes

**Responsibilities:**
- Call metrics (duration, cost, outcome)
- Conversation analytics (turn count, sentiment)
- Agent performance (resolution rate, escalation rate)
- Usage tracking (token usage, minutes)
- Reporting and dashboards

**Tech Stack:**
- Node.js + Fastify
- PostgreSQL (timescale for time-series data)
- Grafana for visualization
- Custom analytics backend

**Metrics:**
- Real-time: Active calls, latency, error rates
- Historical: Trends, cost analysis, CSAT scores

#### 1.8 Notification Service
**Purpose:** Alert users and tenants of important events

**Responsibilities:**
- Call completion notifications
- Escalation alerts
- System status notifications
- Scheduled call reminders
- Webhook delivery to integrations

**Tech Stack:**
- Node.js + Fastify
- WebSocket for real-time pushes
- Email (SMTP or service)
- SMS (Twilio)

**Channels:**
- In-app notifications
- Email digests
- SMS alerts
- Webhooks (CRM integrations)

#### 1.9 Integration Service
**Purpose:** API and integration layer for external systems

**Responsibilities:**
- RESTful API for all services
- Webhook callbacks
- CRM integration (Salesforce, HubSpot, custom)
- Authentication and authorization
- API documentation (OpenAPI/Swagger)

**Tech Stack:**
- Node.js + Fastify
- JWT authentication
- OAuth 2.0 for CRM integrations
- Rate limiting and caching

**API Endpoints:**
- `/api/v1/calls` — Call management
- `/api/v1/agents` — Voice agent configuration
- `/api/v1/analytics` — Metrics and reports
- `/api/v1/webhooks` — Webhook configuration

---

### 2. AI Factory Workers (7 Workers)

#### 2.1 LLM Processing Worker
**Purpose:** Process conversations with LLM for understanding and response generation

**Responsibilities:**
- Conversation understanding (intent, entities, sentiment)
- Response generation (next utterance, actions)
- Reasoning and decision making
- Tool calling and function execution

**Tech Stack:**
- OpenAI GPT-4o (primary)
- Claude 3.5 Sonnet (fallback)
- LangChain for orchestration

**Optimization:**
- Model selection per use case (simple vs complex)
- Prompt engineering and templates
- Response caching for common queries

#### 2.2 STT Processing Worker
**Purpose:** Batch audio transcription for analytics and training

**Responsibilities:**
- Call recording transcription (post-call)
- High-accuracy transcription
- Timestamp alignment
- Speaker labeling

**Tech Stack:**
- OpenAI Whisper (large-v3)
- ElevenLabs STT (alternative)

**Use Cases:**
- Call analysis and review
- Training data for fine-tuning
- Compliance documentation

#### 2.3 TTS Processing Worker
**Purpose:** Batch audio synthesis for previews and testing

**Responsibilities:**
- Voice sample generation
- Bulk TTS for pre-recorded messages
- Voice customization

**Tech Stack:**
- OpenAI TTS
- ElevenLabs TTS (higher quality)

#### 2.4 Embedding Worker
**Purpose:** Generate embeddings for vector search and context retrieval

**Responsibilities:**
- Text embedding generation
- Vector storage and indexing
- Similarity search

**Tech Stack:**
- OpenAI text-embedding-3
- Pinecone or pgvector
- Vector similarity search algorithms

#### 2.5 Knowledge Base Worker
**Purpose:** Maintain and query organization knowledge base

**Responsibilities:**
- Document ingestion (PDFs, websites, databases)
- Knowledge chunking and storage
- Retrieval and RAG
- Knowledge updating

**Tech Stack:**
- Vector database (Pinecone)
- Document processing (pdf-parse, web scraping)
- LLM for summarization

#### 2.6 Prompt Optimization Worker
**Purpose:** Continuously improve prompts for better conversations

**Responsibilities:**
- A/B testing prompts
- Performance analysis (success rate, CSAT)
- Automatic prompt tuning
- Prompt versioning

**Tech Stack:**
- ML for optimization
- A/B testing framework
- Analytics data

#### 2.7 Fine-tuning Worker
**Purpose:** Fine-tune models on customer-specific data

**Responsibilities:**
- Training data collection (from real calls)
- Model fine-tuning (GPT-4o fine-tuning)
- Evaluation and deployment

**Tech Stack:**
- OpenAI fine-tuning API
- Custom evaluation metrics

---

## Data Architecture

### Data Flow

```
Incoming Call
    ↓
Call Management Service
    ↓
Voice Agent Service (orchestration)
    ↓
    ├─→ Real-time Transcription Service (STT)
    ├─→ LLM Processing Worker (understanding)
    ├─→ Context Management Service (retrieval)
    └─→ Real-time Synthesis Service (TTS)
    ↓
Audio to Caller
    ↓
Analytics Service (metrics)
    ↓
Notification Service (completion)
```

### Data Storage

**Hot Data (Redis):**
- Active sessions
- Conversation context (short-term)
- Rate limiting and caching

**Warm Data (PostgreSQL):**
- Conversation history
- Call records and metadata
- Tenant configurations
- User accounts and auth

**Cold Data (S3-compatible):**
- Call recordings (audio)
- Transcriptions (text files)
- Logs and archives

**Vector Data (Pinecone/pgvector):**
- Knowledge base embeddings
- Conversation history embeddings
- Similarity search index

---

## Security Architecture

### Data Protection
- **Encryption at Rest:** AES-256 for recordings and stored data
- **Encryption in Transit:** TLS 1.3 for all communications
- **PII Handling:** Masked/anonymized before storage in analytics
- **Call Recording:** Compliance with consent requirements

### Tenant Isolation
- **Database:** Row-level security with tenant_id
- **Redis:** Namespaced keys per tenant
- **API:** Strict tenant authentication and authorization
- **Infrastructure:** VPC isolation (future)

### Compliance
- **GDPR:** Data portability, right to deletion
- **LGPD:** Brazilian data protection compliance
- **TCPA:** Consent for outbound calls
- **Recording Laws:** Notification before recording

---

## Observability

### Monitoring
- **Metrics:** Prometheus (system, service, business metrics)
- **Tracing:** OpenTelemetry for distributed tracing
- **Logging:** Structured JSON logs (ELK stack)
- **Alerting:** PagerDuty or similar (critical incidents)

### Key Metrics
- **System:** CPU, memory, disk, network
- **Service:** Request latency, error rates, throughput
- **Business:** Active calls, cost per call, CSAT scores
- **AI:** Token usage, response time, accuracy

---

## Deployment Architecture

### Environments
- **Development:** Local or dev cluster
- **Staging:** Production-like environment for validation
- **Production:** Customer-facing environment

### Deployment Strategy
- **Infrastructure as Code:** Terraform or CloudFormation
- **CI/CD:** GitHub Actions or GitLab CI
- **Containers:** Docker + Kubernetes
- **Blue-Green Deployments:** Zero-downtime updates

### Scaling
- **Horizontal:** Kubernetes HPA based on CPU/memory
- **Vertical:** Instance size adjustments
- **Autoscaling:** Triggered by concurrent calls and latency

---

## Initial Integration: A7Protect

### Integration Points
- **SDR Workflow:** Outbound calls for sales qualification
- **Emergency Response:** Inbound urgent calls with priority routing
- **Data Synchronization:** CRM integration for customer data
- **Reporting:** Analytics dashboard for A7Protect operations

### Specific Requirements
- Multi-tenant (A7Protect as first tenant)
- Custom voice personality for emergency scenarios
- Real-time alerts for critical calls
- Integration with existing A7Protect systems

---

## Technology Decisions (ADRs)

### ADR-001: OpenAI as Primary AI Provider
**Decision:** Use OpenAI GPT-4o, Whisper, and TTS as primary
**Alternatives Considered:** Claude-only, ElevenLabs-only, local models
**Rationale:**
- Best performance/cost ratio for production workloads
- Streaming capabilities for real-time STT/TTS
- Proven reliability at scale
- Claude as fallback for resilience

### ADR-002: PostgreSQL + Redis + Pinecone
**Decision:** Multi-database architecture for different data types
**Alternatives Considered:** All PostgreSQL, all Redis, MongoDB
**Rationale:**
- Postgres for relational data and transactions
- Redis for high-speed caching and sessions
- Pinecone for vector search (specialized, better performance)

### ADR-003: Multi-Service Architecture
**Decision:** 9 separate Runtime Services instead of monolith
**Alternatives Considered:** Monolithic application, microservices
**Rationale:**
- Independent scaling (STT needs more resources than others)
- Team development autonomy
- Easier to reason about and maintain
- Natural fit for AI processing pipeline

---

**Last Updated:** 2026-03-06
**Architecture Version:** 1.0
