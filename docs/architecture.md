# Cham.ai — Architecture (Runtime + AI Factory)

Este documento define a arquitetura oficial do Cham.ai em duas camadas separadas:

1) **Runtime (produção):** atende chamadas, executa agentes, integra sistemas, mede custo e gera auditoria.
2) **AI Factory (desenvolvimento):** automatiza criação/alteração de código com agentes, sempre via sandbox, com padrões e tickets.

**Objetivo macro:**
- **Operação com menor custo possível**
- **Qualidade máxima e consistente**
- **Evolução rápida e segura**
- **Sem lock-in** (providers trocáveis)

---

## 0) Princípios (não negociáveis)

1. Runtime e Factory são ambientes separados (rede, credenciais e permissões).
2. Nenhuma execução de código "gerado por IA" roda fora do sandbox.
3. Toda alteração de Runtime passa por testes + validação + revisão de segurança + revisão de custo.
4. Toda chamada/ação tem trilha de auditoria (call_id + tenant_id).
5. Providers (Telephony/STT/TTS/UI) são pluggáveis. O core nunca depende de um fornecedor.

---

## 1) Estrutura do Repositório (recomendado)

```
cham-ai/
├── runtime/                    # Ambiente de produção
│   ├── services/             # Serviços core
│   │   ├── telephony-gateway/
│   │   ├── speech-service/
│   │   ├── dialog-service/
│   │   ├── agent-orchestrator/
│   │   ├── tool-gateway/
│   │   ├── ui-executor/
│   │   ├── billing-metering/
│   │   ├── audit-log/
│   │   └── integration-hub/
│   ├── contracts/           # Contratos internos (eventos, schemas)
│   ├── infra/               # Infraestrutura (docker-compose, k8s, etc.)
│   └── docs/                # Documentação Runtime
└── ai-factory/                # Ambiente de desenvolvimento
    ├── router/              # Orquestrador de tickets
    ├── workers/              # Workers especializados
    ├── sandbox/              # Ambientes isolados
    ├── scripts/              # Scripts de automação
    ├── patterns/             # Padrões reutilizáveis
    ├── tickets/              # Tickets de desenvolvimento
    ├── docs/                 # Documentação Factory
    └── CLAUDE.md            # Guia de operação
```

---

## 2) Runtime (produção): visão geral

**Fluxo macro:**

```
Telefone (PSTN/SIP)
    ↓
Telephony Provider (ex: ClawdTalk)
    ↓
telephony-gateway (normaliza eventos + áudio)
    ↓
speech-service (STT streaming + VAD)
    ↓
dialog-service (resposta rápida / triagem)
    ↓
agent-orchestrator (OpenClaw quando necessário)
    ↓
tool-gateway (execução segura de tools)
    ↓
ui-executor (PhoneDriver/Open-AutoGLM quando não há API)
    ↓
integration-hub (A7Protect e outros)
    ↓
billing-metering + audit-log (custo, logs, evidências)
```

---

## 3) Serviços do Runtime (o que cada um faz)

### 3.1 telephony-gateway

**Responsável por:**
- Integrar com provider de telefonia (ClawdTalk inicialmente)
- Receber eventos e mídia
- Gerar call_id interno
- Manter estado da call
- Publicar eventos na fila interna

**Entradas:**
- Webhooks do provider
- Stream de áudio (ws/rtp conforme provider)

**Saídas:**
- Eventos normalizados para o bus interno
- Áudio para speech-service

**Regras:**
- Idempotência forte (event_id)
- Retry com backoff
- Never trust client-provided tenant_id

---

### 3.2 speech-service

**Responsável por:**
- STT streaming (provider ou self-host)
- Segmentação com timestamps
- Detecção de silêncio (VAD)
- Normalizar transcrição

**Regras:**
- Não transcrever silêncio
- Qualidade adaptativa (modo econômico vs premium)
- Mascarar PII conforme políticas

**Saídas:**
- `transcript.segment.created` events

---

### 3.3 dialog-service (fast path)

**Responsável por:**
- Respostas rápidas (triagem, FAQ, coleta)
- Reduzir custo (evitar OpenClaw quando não precisa)
- Detectar intenção e encaminhar para agent-orchestrator se necessário

**Saídas:**
- Respostas para telephony-gateway (TTS/voice response)
- Ou "handoff" para OpenClaw

**Nota:**
Corte de custo é o **corte de custo** do sistema.

---

### 3.4 agent-orchestrator (agent path)

**Responsável por:**
- Rodar o OpenClaw
- Tomar decisões e executar tools
- Manter contexto por call_id
- Produzir plano + ações

**Regras:**
- Contexto mínimo e incremental (evitar prompt gigante)
- Tool calling sempre via tool-gateway
- Circuito de fallback (se IA falhar, operação continua)

---

### 3.5 tool-gateway (execução segura)

**Responsável por:**
- Permitir execução de ferramentas de forma controlada
- Enforce allowlist/denylist por tenant e por campanha
- Rate limit por tool
- Audit log de cada tool call
- Retorno padronizado para o agente

**Exemplos de tools:**
- `crm.create_lead`
- `a7protect.open_incident`
- `notify.sms_send`
- `dispatch.find_provider_nearby`
- `ui.mission.execute`

**Regras:**
- Toda tool call deve ter call_id, tenant_id, actor
- Ferramentas sensíveis exigem aprovação (needs_approval)

---

### 3.6 ui-executor (missões em Android)

**Responsável por:**
- Executar "missões UI" quando não existe API
- Controlar Android via ADB + visão (PhoneDriver / Open-AutoGLM)
- Retornar evidências (screenshots, logs, vídeo opcional)

**Estados:**
- `queued` / `running` / `needs_approval` / `done` / `failed`

**Regras:**
- Isolamento por tenant (device lock)
- Allowlist de apps
- Takeover humano em ações críticas (pagamento, login, senha)

---

### 3.7 integration-hub

**Responsável por:**
- Integrar com A7Protect (primeiro case)
- Expor conectores para outros nichos depois
- Normalizar webhooks externos para eventos internos

**Regras:**
- Adapter per system (nunca colar lógica no core)
- Contratos versionados em `/contracts`

---

### 3.8 billing-metering

**Responsável por:**
- Registrar consumo por tenant e por campanha
- Unir custos:
  - Telecom (CDR / provider)
  - STT
  - TTS
  - LLM
  - UI missions

**Integrações:**
- MagnusBilling para telecom rating quando aplicável

---

### 3.9 audit-log (imutável)

**Responsável por:**
- Trilha completa de operações
- Evidência (áudio, transcrição, tool calls, resultados)
- Compliance e depuração

**Regras:**
- Logs imutáveis
- PII mascarada (exceto quando autorizado)
- Export por tenant

---

## 4) Contracts (contratos internos mínimos)

### 4.1 Call Event

```typescript
interface CallEvent {
  event_id: string;           // UUID único
  call_id: string;           // ID interno da chamada
  tenant_id: string;         // Tenant que iniciou
  provider: string;           // "clawdtalk"
  direction: "inbound" | "outbound";
  status: "ringing" | "connected" | "ended";
  timestamp: ISO8601;
  metadata: Record<string, any>;
}
```

### 4.2 Transcript Segment

```typescript
interface TranscriptSegment {
  call_id: string;
  tenant_id: string;
  segment_index: number;     // 0, 1, 2...
  text: string;
  start_ms: number;        // Timestamp no áudio
  end_ms: number;
  confidence: number;       // 0.0 - 1.0
}
```

### 4.3 Tool Call

```typescript
interface ToolCall {
  call_id: string;
  tenant_id: string;
  tool_name: string;        // "a7protect.open_incident"
  arguments: Record<string, any>;
  actor: {
    type: "agent";
    id: "openclaw";
  };
  policy: {
    needs_approval: boolean;
  };
}
```

### 4.4 UI Mission Result

```typescript
interface UIMissionResult {
  mission_id: string;
  call_id: string;
  tenant_id: string;
  status: "done" | "failed" | "needs_approval";
  artifacts: {
    screenshots: string[];
    action_log: any[];
  };
}
```

---

## 5) Provider Interfaces (anti lock-in)

O core do Cham.ai nunca chama um provider diretamente. Ele chama interfaces internas:

- **TelephonyProvider** — ClawdTalk (inicial), SIP Trunk (Issabel), Twilio (futuro)
- **SpeechProvider** — provider do ClawdTalk (inicial), faster-whisper (self-host)
- **VoiceSynthesisProvider** — provider de ClawdTalk
- **AgentEngine** — OpenClaw
- **UIExecutor** — PhoneDriver
- **TelecomBillingProvider** — MagnusBilling

**Cada interface tem múltiplas implementações possíveis.**

---

## 6) AI Factory (desenvolvimento): visão geral

A Factory automatiza criação/manutenção do Cham.ai com pipeline previsível:

**PLAN → IMPLEMENT → REVIEW → SECURITY_REVIEW → COST_REVIEW → UI → VALIDATE → PR**

Tudo sempre rodando dentro do OpenSandbox.

---

## 7) Workers (funções)

### plan_worker
- Lê ticket
- Cria plano usando padrões
- Define passos e riscos

### implement_worker
- Aplica patch
- Roda testes/lint/build em sandbox

### review_worker
- Refatora
- Corrige arquitetura
- Melhora legibilidade

### security_review_worker (obrigatório)
Verifica:
- Secrets
- Permissões
- SSRF / injections
- Logging indevido de PII
- Validação de inputs
- Allowlist de tools

### cost_review_worker (obrigatório)
Verifica:
- Chamadas extras a LLM/STT/TTS
- Loops e retries
- Risco de "gastar tokens por silêncio"
- Tempo de call desnecessário

### ui_worker
- Melhora frontend (site + dashboard)
- Aplica padrões de componentes

### validate_worker
- Roda testes end-to-end
- Smoke tests
- Valida contratos

---

## 8) Sandbox Profiles (OpenSandbox)

Perfis recomendados:

### code_exec (código e testes)
- `network: restricted`
- `cpu: 2`
- `memory: 2GB`
- `timeout: 900`
- `browser: -`
- `allowed_hosts: []`

### network_open (integrações)
- `network: open`
- `cpu: 2`
- `memory: 2GB`
- `timeout: 900`
- `browser: -`
- `allowed_hosts: []`

### chrome + vnc (UI development)
- `network: open`
- `cpu: 4`
- `memory: 4GB`
- `timeout: 600`
- `browser: chrome + vnc`
- `allowed_hosts: []`

### ml_training (fine-tuning)
- `cpu: 8`
- `ram: 16GB`
- `gpu: true`
- `timeout: 3600`

---

## 9) Regras de Qualidade e Custo (Runtime)

1. **Implementar VAD** (não pagar por silêncio).
2. **Implementar Intent Router** (fast vs agent path).
3. **Implementar "modo degradado":**
   - Se latência sobe, degrade TTS
   - Se fila cresce, callback
   - Se LLM falhar, fallback leve
4. **Limites por tenant:**
   - Minutos/dia
   - Tokens/min
   - Custo/dia
5. **Observabilidade:**
   - p50/p95 latência
   - Custo por chamada
   - Taxa de handoff
   - Tool success rate

---

## 10) A7Protect como primeiro case

O primeiro case valida:
- SDR de vendas
- Suporte
- Emergência / acionamentos
- Prova de execução (evidência)

A7Protect serve como laboratório para descobrir:
- Duração média
- Custos reais
- Flows que mais convertem
- Onde a IA precisa de handoff

---

## 11) Resultado esperado

Com essa arquitetura:
- Você valida rápido com ClawdTalk
- Controla custo com gates e fast-path
- Mantém qualidade com tool governance
- Internaliza providers depois sem reescrever
- Evolui com segurança via AI Factory
