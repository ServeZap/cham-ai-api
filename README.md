# Cham.ai — Voice AI Platform

AI-powered voice agents for automated customer interactions, sales, and support.

---

## Overview

Cham.ai is a real-time Voice AI Platform that enables businesses to replace or augment human call center agents with AI-powered voice assistants. The platform provides natural, conversational AI that can handle both inbound and outbound calls with human-like voice quality.

**Built by:** ServeZap (AI Agency)
**Status:** Planning Phase
**First Customer:** A7Protect (Intelligent Operations Center)

---

## Core Capabilities

### Voice AI Agents
- **Inbound Calls:** Customer support, information requests, appointments
- **Outbound Calls:** SDR automation, surveys, notifications
- **Real-time Conversation:** Natural language understanding and response
- **Multi-tenant:** Isolated environments for multiple customers

### Speech Processing
- **Speech-to-Text (STT):** Real-time transcription with <2s latency
- **Text-to-Speech (TTS):** Natural voice synthesis with <1s latency
- **Multiple Languages:** English, Portuguese, Spanish (expanding)

### Integration
- **Telephony:** Twilio, Plivo, custom SIP
- **CRM:** Salesforce, HubSpot, custom integrations
- **Webhooks:** Real-time callbacks and event delivery

---

## Architecture

Cham.ai consists of **9 Runtime Services** and **7 AI Factory Workers**:

### Runtime Services (Real-time)
1. **Voice Agent Service** — Core conversational orchestration
2. **Call Management Service** — Telephony and call lifecycle
3. **Session Management Service** — Multi-tenant session isolation
4. **Real-time Transcription Service** — STT processing
5. **Real-time Synthesis Service** — TTS processing
6. **Context Management Service** — Conversation memory and retrieval
7. **Analytics Service** — Metrics, reporting, insights
8. **Notification Service** — Alerts and event delivery
9. **Integration Service** — API and third-party integrations

### AI Factory Workers (Background)
1. **LLM Processing Worker** — Understanding and response generation
2. **STT Processing Worker** — Batch transcription and analytics
3. **TTS Processing Worker** — Voice synthesis and customization
4. **Embedding Worker** — Vector generation and search
5. **Knowledge Base Worker** — Document ingestion and RAG
6. **Prompt Optimization Worker** — A/B testing and tuning
7. **Fine-tuning Worker** — Custom model training

**See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical design.**

---

## Technology Stack

### Frontend
- React 18+
- Next.js 14+
- Tailwind CSS
- shadcn/ui

### Backend
- Node.js 20+
- TypeScript 5+
- Fastify

### Data
- PostgreSQL 16+
- Redis 7+
- Pinecone/pgvector (vector search)

### AI Providers
- **LLM:** OpenAI GPT-4o (primary), Claude 3.5 Sonnet (fallback)
- **STT:** OpenAI Whisper, ElevenLabs
- **TTS:** OpenAI TTS, ElevenLabs

### Infrastructure
- Cloud: Hetzner/AWS
- Containers: Docker + Kubernetes
- Monitoring: Prometheus + Grafana

---

## Use Cases

### 1. SDR Automation
Outbound calls for sales qualification, lead generation, and appointment setting.

**Benefits:**
- Scale outbound campaigns without hiring
- Consistent messaging and qualification
- Real-time lead scoring

### 2. Customer Support
Inbound calls for support, information, and problem resolution.

**Benefits:**
- 24/7 availability
- Instant response time
- Reduced support costs

### 3. Emergency Response
Urgent inbound calls with priority routing and escalation.

**Benefits:**
- Immediate response to critical situations
- Automated dispatch and notification
- Consistent emergency protocols

---

## Timeline

### Phase 1: Foundation (Weeks 1-4) — Current
- ✅ Architecture defined
- ✅ Tech stack selected
- ✅ Project genome created
- ⏳ Development environment setup
- ⏳ CI/CD pipeline setup

### Phase 2: Core Services (Weeks 5-12)
- Voice Agent Service
- Call Management Service
- Session Management Service
- Basic STT/TTS integration

### Phase 3: Advanced Features (Weeks 13-20)
- Context Management
- Analytics Service
- Knowledge Base integration
- Custom voices and personalities

### Phase 4: A7Protect Case Study (Weeks 21-24)
- SDR workflow for A7Protect
- Emergency response automation
- Integration with A7Protect systems
- Real-world validation and data collection

### Phase 5: MVP Launch (Weeks 25-28)
- Security, Cost, Quality gates
- Production deployment
- Documentation and onboarding
- Public launch preparation

---

## Governance

Cham.ai follows ServeZap governance standards:

- **AEGS v1.0** — Architecture and Engineering Governance Standard
- **AEMM v1.0** — AI Engineering Maturity Model
- **Mandatory Gates:** Security Review, Cost Review, Quality Validation

### Directors Involved
- CTO Director — Architecture and voice AI
- Product Director — Voice UX and workflows
- DevOps Director — Real-time infrastructure
- Security Director — Compliance and call recording
- Financial Director — Unit economics and pricing
- Quality Director — Call quality and reliability

---

## Documentation

- [PROJECT_GENOME.md](PROJECT_GENOME.md) — Project DNA and strategy
- [ARCHITECTURE.md](ARCHITECTURE.md) — Technical architecture
- [REQUIREMENTS.md](REQUIREMENTS.md) — Functional requirements (coming)
- [ARTIFACT_MANIFEST.json](ARTIFACT_MANIFEST.json) — Artifact inventory (coming)

---

## Repository

**Project Location:** `/root/.openclaw/workspace/projects/cham-ai/`
**Registry Entry:** See `/root/.openclaw/agents/servezap/PROJECT_REGISTRY.md`

---

## Contact

**Project Owner:** Hector Noya
**Agency:** ServeZap (AI Agency)

---

**Last Updated:** 2026-03-06
