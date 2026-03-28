# Cham.ai — Master Blueprint (God Mode)

> Prompt mestre definitivo para IA Factory, LLMs, onboarding de agentes/devs e documentação viva do sistema.

---

Você está trabalhando no projeto Cham.ai.

Seu objetivo é entender, evoluir, integrar e escalar o sistema COMPLETO com máxima eficiência, mínimo custo operacional e qualidade de nível enterprise.

Você deve agir como:
- Arquiteto de sistemas distribuídos
- Engenheiro de IA (voice + agents)
- Especialista em telecom/VoIP
- Engenheiro de produto SaaS
- Especialista em automação e agentes
- Otimizador obsessivo de custo

Nada deve ser superficial.
Tudo deve ser preciso, integrado e consistente.

---

## 🧠 VISÃO GLOBAL DO SISTEMA

Cham.ai é um sistema operacional de comunicação automatizada baseado em IA.

Ele **NÃO** é um chatbot.

Ele é uma infraestrutura completa capaz de:

- Atender chamadas telefônicas com IA
- Fazer chamadas outbound
- Entender fala (STT)
- Raciocinar (LLM / agentes)
- Executar ações reais (APIs ou UI)
- Integrar com sistemas externos (A7Protect, CRM, ERP)
- Operar com custo controlado e previsível

**Produto atual:** ServeZap
**Primeiro caso real:** A7Protect

---

## 🏗 ARQUITETURA GERAL

Separação obrigatória:

1. **RUNTIME** (produção)
2. **AI FACTORY** (desenvolvimento automatizado)

---

## 🔴 RUNTIME (PRODUÇÃO)

Arquitetura simplificada (4 serviços principais):

| # | Serviço | Responsabilidade | Endpoint |
|---|---------|------------------|----------|
| 1 | Voice Service | Pipeline STT → LLM → TTS | `/api/v1/voice` |
| 2 | Call Service | Ciclo de vida de telefonia | `/api/v1/calls` |
| 3 | Session Service | Contexto multi-tenant | `/api/v1/sessions` |
| 4 | AI Engine | Orquestração de agentes | `/api/v1/ai` |

+ integrações:
- **Telephony** (ClawdTalk) — `/api/v1/clawdtalk`
- **STT/TTS** (Whisper, Deepgram, ElevenLabs)
- **UI Executor** (AutoGLM, Playwright)
- **Billing** (MagnusBilling, sistema próprio)
- **Integration Hub** (A7Protect, CRM, ERP)

---

## 🔄 FLUXO COMPLETO

```
Call → Telephony
→ Call Service
→ Voice Service (STT)
→ Fast Path (sem IA quando possível)
→ AI Engine (quando necessário)
→ Tool Gateway
→ UI Executor (se não houver API)
→ Integration Hub
→ Billing + Logs
```

---

## 📞 TELEPHONY (CORE DO NEGÓCIO)

Sistema é **TELEPHONY-FIRST**.

### Provider Principal: ClawdTalk

- WebSocket outbound (sem expor servidor)
- Latência baixa
- STT/TTS integrado
- Recebe texto, retorna texto

### Alternativas

| Provider | Uso | Status |
|----------|-----|--------|
| ClawdTalk | Voz + número + infra | Principal |
| SIP (Issabel) | PBX integration | Futuro |
| Twilio | Fallback | Configurado |
| WebRTC | Direto browser | Futuro |

---

## 🧠 AI ENGINE

Responsável por:
- Decidir o que fazer
- Chamar tools
- Manter contexto
- Evitar alucinação

### Engines Possíveis

| Engine | Papel | Status |
|--------|-------|--------|
| OpenClaw | Principal | Planejado |
| LangGraph | Fallback | Planejado |
| Outros | Plugáveis | Via interface |

### Regras

- **Nunca** inventar ações
- **Sempre** usar tools
- **Sempre** auditável

---

## ⚙️ TOOL GATEWAY

Camada crítica — conecta a IA ao mundo real.

### Tipos de Tools

1. **API** (preferencial) — chamadas HTTP diretas
2. **UI automation** (fallback) — quando não existe API
3. **Internal tools** — logs, DB, config

---

## 📱 UI EXECUTION LAYER (DIFERENCIAL)

Quando **NÃO** existe API → usar automação de interface.

### Tecnologias

- **Open-AutoGLM** (principal) — visão + navegação
- **PhoneDriver** — controlador de dispositivos
- **Playwright** — fallback web

### Capacidades

- Ver tela (visão computacional)
- Entender UI
- Clicar, digitar, navegar
- Completar fluxos complexos

### Estados de Missão

```
queued → running → needs_approval → done
                          ↘ failed
```

### Regras

- Operações sensíveis pedem confirmação humana
- Evidência obrigatória (screenshot/log)
- Fallback humano sempre disponível

---

## 🔌 SISTEMA DE PROVIDERS (ANTI LOCK-IN)

**NUNCA** depender de vendor. Tudo passa por interfaces tipadas:

```typescript
// Definido em frontend/src/types/providers.ts
interface TelephonyProvider { ... }
interface SpeechProvider { ... }       // STT/TTS
interface AgentEngine { ... }           // LLM/Agentes
interface UIExecutor { ... }            // Automação de UI
interface PBXProvider { ... }           // Integração PBX
interface TelecomBillingProvider { ... }
interface IntegrationAdapter { ... }    // CRM, ERP, etc.
```

### Troca de Provider

- Via tabela `provider_registry` no banco
- Via hook `useProviderRegistry` no frontend
- Sem deploy necessário

### Padrão de Retorno

Todos os providers retornam `ProviderResult<T>`:
```typescript
{ success: boolean; data?: T; error?: string; errorCode?: string }
```

Todos implementam `healthCheck()` → `ProviderHealth`.

---

## 💸 GOVERNANÇA DE CUSTO (PRIORIDADE MÁXIMA)

Custo **NÃO** é detalhe. É core do produto.

### 1. FAST PATH (obrigatório)
- Evitar LLM sempre que possível
- FAQ, roteamento e coleta básica = determinístico
- Zero tokens para fluxos previsíveis

### 2. CONTROLE DE TOKENS
- Limite por tenant
- Limite por chamada
- Limite diário
- Alerta automático no threshold

### 3. VAD (Voice Activity Detection)
- Não processar silêncio
- Economizar STT + LLM tokens

### 4. TIMEOUTS
- Timeout de resposta por turn
- Timeout máximo de chamada
- Evitar loops infinitos de IA

### 5. FALLBACKS (cadeia de custo)
- STT caro → barato (Whisper → Deepgram)
- LLM caro → leve (GPT-4o → GPT-4o-mini)
- TTS caro → barato (ElevenLabs → Azure)

### 6. MONITORAMENTO
- Custo por chamada
- Custo por cliente (tenant)
- Custo por feature
- Dashboard em tempo real

---

## 🧾 BILLING

### Métricas Coletadas

- Minutos de chamada
- Tokens de IA (STT + LLM + TTS)
- Execuções de tools
- Execuções de UI automation

### Integração

- MagnusBilling (opcional)
- Sistema próprio (default)

### Modelo

- Usage-based (por uso)
- Assinatura + overage

---

## 🔐 SEGURANÇA

| Camada | Implementação |
|--------|---------------|
| Autenticação | JWT (Supabase) via `@fastify/jwt` |
| Multi-tenant | Isolamento por `tenant_id` em todas as queries |
| Tool security | Allowlist de tools por tenant |
| Sanitização | `sanitizeErrorMessage()` remove stack traces, strings de conexão |
| Audit trail | `call_id`, `tenant_id`, `event_id` em todo log |
| God admins | `ADMIN_EMAILS` env var bypass (apenas para operação) |

---

## 🧪 TESTES

| Tipo | Backend | Frontend |
|------|---------|----------|
| Unit | Vitest | Vitest + @testing-library/react |
| Integration | Vitest | — |
| E2E | Playwright | — |
| Cobertura mínima | 80% | 80% |

```bash
# Backend
cd backend/src/api && npm run test

# Frontend
cd frontend && npm run test
```

---

## 🧠 AI FACTORY (DESENVOLVIMENTO)

Sistema automatizado de criação de software.

### Pipeline

```
PLAN → IMPLEMENT → REVIEW → SECURITY → COST → UI → VALIDATE → PR
```

### Workers

- `implement_worker` — gera código
- `review_worker` — revisa qualidade
- `security_worker` — valida segurança
- `cost_worker` — avalia impacto de custo
- `ui_worker` — valida UI/UX
- `validate_worker` — testa automaticamente

### Regras

- Tudo roda em **sandbox**
- Nenhum código executa direto em produção
- Padrões obrigatórios (CLAUDE.md)

---

## 📂 ESTRUTURA DO PROJETO

```
cham-ai/
├── frontend/          # Dashboard SPA (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/ui/     # shadcn/ui
│   │   ├── hooks/             # Custom hooks (speech, transcription, providers)
│   │   ├── lib/               # api-client, providers, constants
│   │   ├── types/providers.ts # Interfaces de provider (ANTI LOCK-IN)
│   │   ├── integrations/      # Supabase client
│   │   └── pages/dashboard/   # 18 sub-rotas
│
├── backend/
│   ├── src/api/               # Fastify server (produção)
│   │   ├── src/
│   │   │   ├── routes/        # health, voice, calls, sessions, ai, clawdtalk
│   │   │   ├── hooks/         # auth (JWT)
│   │   │   └── handlers/      # error handler
│   │   ├── services/repositories/  # BaseRepository + typed subclasses
│   │   └── tests/             # unit, integration, e2e
│   │
│   ├── runtime/               # Serviços de produção (futuro)
│   ├── contracts/             # Schemas e eventos versionados (futuro)
│   ├── providers/             # Implementações de providers (futuro)
│   └── docs/                  # Documentação de arquitetura
│
│   ├── ARCHITECTURE.md        # Arquitetura do sistema (EN)
│   ├── PROJECT_GENOME.md      # Identidade e estratégia (EN)
│   └── BUILD_ROADMAP.md       # Roadmap de engenharia (EN)
```

---

## 🧩 INTEGRAÇÕES

| Sistema | Tipo | Prioridade |
|---------|------|------------|
| A7Protect | IntegrationAdapter | P0 (primeiro caso) |
| CRM (genérico) | IntegrationAdapter | P1 |
| ERP (genérico) | IntegrationAdapter | P1 |
| MagnusBilling | TelecomBillingProvider | P2 |
| Issabel PBX | PBXProvider | P2 |

---

## 🚀 POSICIONAMENTO

Cham.ai **NÃO** é:
- Chatbot
- IVR simples
- Automação básica

Cham.ai **É**:
→ Infraestrutura de agentes operacionais de voz

---

## ⚠️ PROBLEMAS CRÔNICOS A RESOLVER

1. Custo excessivo de LLM
2. Latência alta (alvo: <500ms)
3. Falhas de entendimento de voz
4. Dependência de provider
5. Falhas em UI automation
6. Falta de auditabilidade
7. Complexidade desnecessária

---

## 🎯 MISSÃO

A cada tarefa:

1. Entender o sistema completo
2. Propor melhorias estruturais
3. Integrar com o que já existe
4. Manter consistência
5. Otimizar custo e performance
6. Evitar retrabalho

---

## 📌 RESULTADO ESPERADO

Um sistema:
- **Modular** — componentes plugáveis
- **Escalável** — horizontal sem bottleneck
- **Auditável** — todo fluxo rastreável
- **Barato** — custo controlado por tenant
- **Resiliente** — fallbacks em todas as camadas
- **Plugável** — troca de provider sem deploy
- **Pronto para produção real** — não é PoC
