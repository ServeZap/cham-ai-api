# AEGS - Architecture Evaluation & Governance System

**Projeto:** Cham.ai
**Versão:** AEGS v1.0
**Data de criação:** 2026-03-19

---

## 📋 O que é AEGS?

**AEGS** (Architecture Evaluation & Governance System) é o sistema de governança de arquitetura do **ServeZap**. Todas as decisões arquiteturais significativas devem ser registradas e avaliadas através deste sistema.

---

## 📝 Decisões Registradas

### AEGS #001: Simplificação de 16 para 4 Serviços

**Data:** 2026-03-19
**Status:** 🔵 Aprovada

**Contexto:**
Arquitetura anterior previa 16 serviços (9 Runtime + 7 Workers), o que tornaria o MVP inviável em prazo razoável.

**Decisão:**
Simplificar para **4 serviços essenciais**: Voice Service, Call Service, Session Service, AI Engine.

**Justificativa:**
- Time-to-market reduzido (de 7 meses para 5 meses)
- Menor complexidade operacional
- Menor custo de infraestrutura
- Foco no MVP validado com A7Protect

**Alternativas Consideradas:**
1. **Manter 16 serviços** - Complexo demais, arriscado para MVP
2. **Simplificar para 4 serviços** - ✅ Escolhido
3. **Monolito** - Não escalável, técnico debt alto

**Impacto:**
- ✅ MVP 40% mais rápido
- ✅ Menor custo operacional
- ⚠️ Menor granularidade de escala
- ⚠️ Refatoração futura se escalar

**Gates Aprovados:**
| Diretor | Status | Data | Observações |
|---------|--------|------|-------------|
| Security | ✅ Approved | 2026-03-19 | 4 serviços = menor attack surface |
| Financial | ✅ Approved | 2026-03-19 | Economia de ~30% em infra |
| Quality | ✅ Approved | 2026-03-19 | Menos componentes = mais confiável |

---

### AEGS #002: Escolha do LangGraph para AI Engine

**Data:** 2026-03-19
**Status:** 🔵 Aprovada

**Contexto:**
Cham.ai precisa de um orquestrador de conversações com IA que suporte fluxos complexos.

**Decisão:**
Utilizar **LangGraph** como orquestrador de AI workflows.

**Justificativa:**
- Stateful conversations (sessões)
- Visual debugging (LangSmith)
- Integração nativa com OpenAI
- Controle total sobre prompts e tools

**Alternativas Consideradas:**
1. **LangChain** - Mais complexo, menos visual
2. **Vercel AI SDK** - Muito focado em React
3. **LangGraph** - ✅ Escolhido

**Impacto:**
- ✅ Conversações stateful
- ✅ Debugging visual
- ⚠️ Curva de aprendizado
- ⚠️ Vendor lock-in (LangSmith)

**Gates Aprovados:**
| Diretor | Status | Data | Observações |
|---------|--------|------|-------------|
| Security | ✅ Approved | 2026-03-19 | Controle de prompts seguro |
| Financial | ✅ Approved | 2026-03-19 | LangSmith plano dev é gratuito |
| Quality | ✅ Approved | 2026-03-19 | Padrão da indústria |

---

### AEGS #003: Multi-tenancy via Database Isolation

**Data:** 2026-03-19
**Status:** 🔵 Aprovada

**Contexto:**
Cham.ai é SaaS multi-tenant. Precisamos isolar dados de clientes.

**Decisão:**
Usar **database isolation** (tenant_id em todas as tabelas) ao invés de databases separados.

**Justificativa:**
- Mais simples operacionalmente
- Migrations uniformes
- Melhor uso de recursos
- Facilita cross-tenant analytics

**Alternativas Consideradas:**
1. **Database por tenant** - Muito complexo operacionalmente
2. **Schema por tenant** - Compromisso, mas ainda complexo
3. **Row-level security** - ✅ Escolhido

**Impacto:**
- ✅ Operação simplificada
- ✅ Melhor uso de recursos
- ⚠️ Risco de data leakage (mitigado com RLS)
- ⚠️ Single point of failure

**Gates Aprovados:**
| Diretor | Status | Data | Observações |
|---------|--------|------|-------------|
| Security | ✅ Approved | 2026-03-19 | RLS do PostgreSQL garante isolamento |
| Financial | ✅ Approved | 2026-03-19 | Mais eficiente economicamente |
| Quality | ✅ Approved | 2026-03-19 | Padrão SaaS comprovado |

---

## 📌 Próximas Decisões

- AEGS #004: Escolha do banco vetorial (Pinecone vs pgvector)
- AEGS #005: Estratégia de rate limiting por tenant
- AEGS #006: Arquitetura de webhooks para integrações

---

*Última atualização: 2026-03-19*
