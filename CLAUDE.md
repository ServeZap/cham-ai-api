# CLAUDE.md

Este arquivo fornece orientação ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Visão Geral do Projeto

Cham.ai é uma plataforma de Voice AI (produto ServeZap) que habilita agentes de voz com IA para comunicações empresariais — chamadas inbound/outbound, processamento de fala e IA conversacional. Atualmente na Fase de Fundação, tendo a A7Protect como primeiro caso de cliente.

## Estrutura do Repositório

```
cham-ai/
├── frontend/          # Dashboard SPA (Vite + React + TypeScript)
├── backend/
│   ├── runtime/       # Serviços de produção (futuro)
│   ├── contracts/     # Schemas e eventos versionados (futuro)
│   ├── providers/     # Implementações de providers (futuro)
│   ├── docs/          # Documentação de arquitetura (PT/EN)
│   ├── src/api/       # Servidor API Fastify (atual)
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── routes/       # health, voice, calls, sessions, ai, clawdtalk
│   │   │   ├── hooks/        # hook de autenticação
│   │   │   └── handlers/     # tratador de erros
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   ├── e2e/
│   │   │   ├── mocks/        # mocks de openai, twilio, pg, fastify
│   │   │   ├── fixtures/
│   │   │   ├── helpers/
│   │   │   └── setup.ts
│   │   └── services/repositories/
│   ├── ARCHITECTURE.md       # Arquitetura do sistema (EN)
│   ├── PROJECT_GENOME.md     # Identidade e estratégia do projeto (EN)
│   └── BUILD_ROADMAP.md      # Roadmap de engenharia (EN)
```

## Comandos

### Frontend (a partir de `frontend/`)
```bash
npm run dev          # Servidor de desenvolvimento na porta 8080
npm run build        # Build de produção
npm run lint         # ESLint
npm run test         # Vitest (execução única)
npm run test:watch   # Vitest em modo watch
```

### Backend (a partir de `backend/src/api/`)
```bash
npm run dev          # Servidor de desenvolvimento com tsx watch (porta 8000)
npm run build        # Compilação TypeScript
npm run start        # Executar output compilado
npm run test         # Todos os testes
npm run test:unit    # Apenas testes unitários
npm run test:integration  # Apenas testes de integração
npm run test:e2e     # Apenas testes E2E
npm run test:coverage     # Relatório de cobertura (limiar de 80%)
npm run test:watch   # Modo watch
npm run lint         # ESLint
npm run format       # Prettier
```

Executar um único arquivo de teste do backend:
```bash
npx vitest run tests/unit/calls.test.ts
```

Executar um único arquivo de teste do frontend:
```bash
npx vitest run src/test/providers.test.ts
```

## Princípios Críticos (NÃO NEGOCIÁVEIS)

1. **Separação absoluta:** Runtime (produção) ≠ AI Factory (desenvolvimento)
2. **Nunca executar código gerado fora de sandbox**
3. **Todo fluxo deve ser auditável:** `call_id`, `tenant_id`, `event_id`
4. **Providers são substituíveis** — nenhum provider é hardcoded no core
5. **Custo é feature de produto** — toda decisão técnica deve considerar impacto financeiro

## Governança de Custo

Toda feature deve respeitar:

### 1. Fast Path obrigatório
- Evitar LLM quando possível
- FAQ, roteamento e coleta básica devem ser determinísticos

### 2. Controle de consumo por tenant
- Limites de minutos, tokens e custo diário

### 3. Anti-desperdício
- VAD (não processar silêncio)
- Timeout de resposta
- Evitar loops de IA

## Arquitetura

### Design Simplificado de 4 Serviços (AEGS #001)
A arquitetura original de 16 serviços foi simplificada para 4 serviços essenciais:
1. **Voice Service** — Pipeline STT/LLM/TTS (`/api/v1/voice`)
2. **Call Service** — Ciclo de vida de telefonia (`/api/v1/calls`)
3. **Session Service** — Sessão/contexto multi-tenant (`/api/v1/sessions`)
4. **AI Engine** — Orquestração LangGraph (`/api/v1/ai`)

Rota adicional: `/api/v1/clawdtalk` para integração com o provedor de telefonia ClawdTalk.

### Arquitetura do Frontend
- **Vite + React 18 + TypeScript + SWC**, porta 8080
- **UI:** Componentes shadcn/ui (`src/components/ui/`) + Tailwind CSS + Framer Motion
- **Auth:** Supabase Auth via `AuthContext` (`src/contexts/AuthContext.tsx`), wrapper `ProtectedRoute`
- **Dados:** TanStack React Query + cliente Supabase (`src/integrations/supabase/`)
- **Rotas:** React Router v6 — landing page em `/`, dashboard em `/dashboard/*` (18 sub-rotas)
- **Estado:** React Query para estado do servidor, React Context para autenticação

### Sistema de Interfaces de Provider (Anti Lock-In)
O core nunca chama provedores externos diretamente. Todas as integrações passam por interfaces tipadas definidas em `frontend/src/types/providers.ts`:
- `TelephonyProvider` — ClawdTalk, Twilio, Vonage, SIP
- `SpeechProvider` — STT/TTS (Whisper, Deepgram, etc.)
- `AgentEngine` — OpenClaw, LangGraph, Semantic Kernel
- `UIExecutor` — Missões de automação de UI (AutoGLM, Playwright)
- `PBXProvider` — Integração PBX (Issabel, FreePBX, FreeSWITCH)
- `TelecomBillingProvider` — MagnusBilling, PortaOne
- `IntegrationAdapter` — A7Protect, CRM, ERP

Implementações concretas ficam em `frontend/src/lib/` (ex: `telephony-provider.ts`, `speech-provider.ts`), com implementações mock em `frontend/src/lib/mock/`. O hook `useProviderRegistry` lê da tabela Supabase `provider_registry` para permitir troca de provider em runtime por camada.

### Convenções Principais
- Todos os providers retornam `ProviderResult<T>` com `success`, `data`, `error`, `errorCode`
- Todos os providers implementam `healthCheck()` retornando `ProviderHealth`
- Textos da interface do dashboard estão em **Português Brasileiro**
- Mensagens de erro exibidas aos usuários são sanitizadas via `sanitizeErrorMessage()` para remover detalhes internos (stack traces, erros de DB, strings de conexão)
- Rotas do backend usam schemas **Zod** para validação de requests
- Auth do backend usa `@fastify/jwt` com hook global `onRequest`
- Documentação da API disponível em `/docs` (Swagger UI)

### Stack Tecnológica
- **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind 3, shadcn/ui, TanStack Query, Supabase, Framer Motion, Recharts, Zod
- **Backend:** Node.js 20+, Fastify 5, TypeScript 5, PostgreSQL, Redis, OpenAI SDK, Zod, WebSocket
- **Testes:** Vitest (ambos), @testing-library/react (frontend), Playwright (backend E2E)
- **Provedores de IA:** OpenAI GPT-4o (LLM primário), OpenAI Whisper (STT), ElevenLabs (TTS backup)

### Fluxo de Dados
```
Chamada → Telephony Gateway → Speech Service (STT) → Dialog Service (fast path)
        → Agent Orchestrator (complexo) → Tool Gateway → Integration Hub
        → Billing + Audit Log
```
