# Cham.ai - Voice AI Platform

> **Plataforma de Voice AI para assistentes de voz automatizados e atendimento ao cliente**

---

## 📋 Project Card

| Campo | Valor |
|-------|-------|
| **Nome** | Cham.ai |
| **Tipo** | Produto SaaS (ServeZap) |
| **Status** | 🟡 Foundation Phase |
| **Proprietário** | Hector Noya (CEO) |
| **Tech Lead** | TBD |
| **Criação** | 2026-03-05 |
| **Última atualização** | 2026-03-19 |

---

## 🎯 Visão Geral

### O que é Cham.ai?

**Cham.ai** é uma plataforma SaaS de Voice AI que permite empresas criar assistentes de voz automatizados para atendimento ao cliente, suporte e notificações.

### Proposta de Valor

1. **Assistentes de Voz Naturais** - IA que conversa como humano
2. **Setup em Minutos** - Sem necessidade de infraestrutura complexa
3. **Multi-idioma** - Suporte a português, inglês, espanhol
4. **Analytics Avançado** - Transcrição e análise de chamadas

### Casos de Uso

- **Suporte ao Cliente** - Atendimento 24/7 sem filas
- **Agendamento** - Marcação de consultas, reservas
- **Televendas** - Qualificação e triagem de leads
- **Notificações** - Lembretes, confirmações, alertas

---

## 🏗️ Arquitetura (Simplificada)

> **DECISÃO DE ARQUITETURA (AEGS #001)**
> **Data:** 2026-03-19
> **Status:** ✅ Aprovada

**Problema:** Arquitetura anterior com 16 serviços (9 Runtime + 7 Workers) era complexa demais para MVP.

**Solução:** Simplificar para **4 serviços essenciais**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Cham.ai Platform (v2)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Frontend (Dashboard)                    │   │
│  │  Next.js 14 + TypeScript + Tailwind + shadcn/ui     │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                        │                                     │
│  ┌─────────────────────▼───────────────────────────────┐   │
│  │              API Gateway                             │   │
│  │  Fastify + TypeScript + Socket.io                   │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                        │                                     │
│    ┌───────────────────┼───────────────────┐               │
│    │                   │                   │                │
│    ▼                   ▼                   ▼                │
│ ┌────────┐       ┌────────┐       ┌────────┐            │
│ │  Voice │       │  Call  │       │Session │            │
│ │Service │       │Service │       │Service │            │
│ └────┬───┘       └────┬───┘       └────┬───┘            │
│      │                │                │                   │
│      └────────────────┼────────────────┘                   │
│                       │                                     │
│              ┌────────▼────────┐                           │
│              │   AI Engine     │                           │
│              │  (LangGraph)    │                           │
│              └────────┬────────┘                           │
│                       │                                     │
│    ┌──────────────────┼──────────────────┐                 │
│    ▼                  ▼                  ▼                 │
│ ┌────────┐      ┌────────┐      ┌────────┐               │
│ │ OpenAI │      │ Eleven │      │ Twilio │               │
│ │  GPT-4 │      │Labs TTS│      │Vonage  │               │
│ └────────┘      └────────┘      └────────┘               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│              Infrastructure & Data Layer                     │
│                                                             │
│  PostgreSQL 16+ │ Redis 7+ │ Pinecone │ Docker             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4 Serviços Essenciais

#### 1. Voice Service
- **Função:** Gerencia conversas de voz com IA
- **Features:**
  - STT (Speech-to-Text) via OpenAI Whisper
  - LLM Processing via OpenAI GPT-4o
  - TTS (Text-to-Speech) via ElevenLabs/OpenAI
- **API:** `POST /voice/converse`, `WS /voice/stream`

#### 2. Call Service
- **Função:** Gerencia chamadas telefônicas
- **Features:**
  - Inbound calls (via Twilio/Vonage)
  - Outbound calls (campanhas, notificações)
  - Call recording e transcrição
- **API:** `POST /calls/inbound`, `POST /calls/outbound`

#### 3. Session Service
- **Função:** Gerencia sessões e contexto de conversas
- **Features:**
  - Session state management
  - Context history
  - Multi-tenancy isolation
- **API:** `GET /sessions/:id`, `POST /sessions`

#### 4. AI Engine (LangGraph)
- **Função:** Orquestra fluxos de conversação com IA
- **Features:**
  - Prompt templates
  - Tool calling (funcionários)
  - RAG (Knowledge base)
- **API:** `POST /ai/complete`, `POST /ai/tools`

---

## 📊 Modelo de Dados

### Entidades Principais

```sql
-- Tenant (multi-tenancy)
tenants (id, name, plan, api_key, status)

-- Assistentes de Voz
assistants (id, tenant_id, name, voice_id, prompt_template, settings)

-- Sessões de Conversa
sessions (id, assistant_id, status, context, metadata)

-- Mensagens
messages (id, session_id, role, content, audio_url, created_at)

-- Chamadas
calls (id, session_id, direction, phone_number, duration, recording_url)

-- Logs de Uso (billing)
usage_logs (id, tenant_id, service, tokens, seconds, cost)
```

---

## 🚀 Como Começar

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- Contas de API:
  - OpenAI API Key
  - ElevenLabs API Key (opcional)
  - Twilio Account SID (opcional)

### Instalação Local

```bash
# Clonar repositório
git clone https://github.com/servezap/cham-ai.git
cd cham-ai

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas API keys

# Subir containers
docker-compose up -d

# Rodar migrations
npm run migrate

# Acessar
# Dashboard: http://localhost:3000
# API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Variáveis de Ambiente

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/chamai
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

# ElevenLabs (TTS)
ELEVENLABS_API_KEY=your-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Twilio (Telefonia)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890

# Pinecone (Vector DB)
PINECONE_API_KEY=your-key
PINECONE_INDEX=cham-ai
```

---

## 📁 Estrutura do Projeto

```
cham-ai/
├── docs/                    # Documentação
│   ├── README.md           # Este arquivo
│   ├── architecture.md     # Arquitetura detalhada
│   ├── api.md              # Documentação da API
│   └── runbooks/           # Runbooks operacionais
│
├── src/                     # Código fonte
│   ├── web/                # Frontend (Next.js)
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── api/                # Backend (Fastify)
│   │   ├── routes/
│   │   │   ├── voice/
│   │   │   ├── calls/
│   │   │   ├── sessions/
│   │   │   └── ai/
│   │   ├── services/
│   │   └── models/
│   └── ai/                 # AI Engine
│       ├── agents/
│       ├── tools/
│       └── prompts/
│
├── tests/                   # Testes
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── deploy/                  # Deploy
│   ├── docker/
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   └── k8s/                # Manifests Kubernetes
│
├── scripts/                 # Scripts utilitários
│   ├── setup.sh
│   ├── migrate.sh
│   └── seed.sh
│
├── governance/              # Governança ServeZap
│   ├── AEGS.md             # Decisões de arquitetura
│   ├── AEMM.md             # Métricas de maturidade
│   └── gates/              # Gates de aprovação
│
└── .env.example            # Template de variáveis
```

---

## 🛡️ Governança (ServeZap)

**AEGS v1.0** - Architecture Evaluation & Governance System
- Escopo: Todas as decisões de arquitetura devem passar pelo AEGS v1.0
- Decisões já registradas:
  - AEGS #001: Simplificação de 16 para 4 serviços ✅
- Gates Obrigatórios:
  - ✅ Security Director (revisão de segurança)
  - ✅ Financial Director (revisão de custos)
  - ✅ Quality Director (validação)

**AEMM v1.0** - Architecture Engineering Maturity Model
- Target Global: Level 3+ pelo lançamento
- Domínios: Segurança, Multi-Tenancy, Observabilidade, Arquitetura, Idempotência, Performance, Testes, CI/CD, Documentação

**Documentação:** Ver `governance/AEGS.md` e `governance/AEMM.md`

---

## 💰 Pricing

### Planos

| Plano | Chamadas/mês | Tokens | Preço |
|-------|--------------|--------|-------|
| **Starter** | 1,000 | 100K | R$99/mês |
| **Growth** | 10,000 | 1M | R$499/mês |
| **Enterprise** | Ilimitado | Ilimitado | Sob consulta |

---

## 📈 Métricas & KPIs

### Métricas Técnicas
- **Uptime:** > 99.9%
- **Latência de Voz:** < 500ms (round-trip)
- **Transcrição:** > 95% precisão
- **Response Time P95:** < 300ms

### Métricas de Negócio
- **MRR:** Target R$50K em 12 meses
- **Clientes Ativos:** Target 50 em 6 meses
- **Churn Rate:** < 5% mensal
- **NPS:** > 50 em 6 meses

---

## 🗺️ Roadmap

### Phase 1: Foundation (Semanas 1-4)
- [x] Project kickoff
- [x] Arquitetura simplificada (4 serviços)
- [ ] Setup de desenvolvimento
- [ ] Integração OpenAI/ElevenLabs

### Phase 2: Core Services (Semanas 5-12)
- [ ] Voice Service (STT/LLM/TTS)
- [ ] Call Service (Twilio integration)
- [ ] Session Service
- [ ] AI Engine (LangGraph)

### Phase 3: A7Protect Integration (Semanas 13-16)
- [ ] Configuração A7Protect
- [ ] Alertas de voz
- [ ] Testes E2E

### Phase 4: MVP Launch (Semanas 17-20)
- [ ] Security review
- [ ] Performance tuning
- [ ] Deploy produção
- [ ] Documentação final

---

## 📞 Suporte & Comunicação

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Slack:** #cham-ai
- **Email:** cham-ai@servezap.com

---

## 📄 Licença

Copyright © 2026 ServeZap. Todos os direitos reservados.

---

**Status:** 🟡 Foundation Phase
**Próximo Milestone:** Voice Service MVP - 2026-04-16

---

*Última atualização: 2026-03-19*
