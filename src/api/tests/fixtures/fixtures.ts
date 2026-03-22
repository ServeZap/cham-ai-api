/**
 * Test Fixtures - Cham.ai
 *
 * Mock data for testing
 */

export const tenantFixtures = {
  defaultTenant: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Cham.ai Internal',
    slug: 'cham-ai-internal',
    plan: 'enterprise',
    api_key: 'sk-test-internal-key',
    status: 'active',
  },
  starterTenant: {
    id: '660e8400-e29b-41d4-a716-446655440001',
    name: 'Starter Tenant',
    slug: 'starter-tenant',
    plan: 'starter',
    api_key: 'sk-starter-key',
    status: 'active',
  },
};

export const userFixtures = {
  adminUser: {
    id: '550e8400-e29b-41d4a716-446655440000',
    tenant_id: tenantFixtures.defaultTenant.id,
    email: 'admin@cham.ai',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
  },
  endUser: {
    id: '660e8400-e29b-41d4a716-446655440002',
    tenant_id: tenantFixtures.defaultTenant.id,
    email: 'user@cham.ai',
    name: 'End User',
    role: 'user',
    status: 'active',
  },
};

export const assistantFixtures = {
  customerSupport: {
    id: 'assistant-001',
    tenant_id: tenantFixtures.defaultTenant.id,
    name: 'Customer Support',
    voice_id: 'default',
    prompt_template: 'You are a helpful customer support agent.',
    status: 'active',
  },
  salesQualifier: {
    id: 'assistant-002',
    tenant_id: tenantFixtures.defaultTenant.id,
    name: 'Sales Qualifier',
    voice_id: 'nova',
    prompt_template: 'You are a sales qualifier agent.',
    status: 'active',
  },
  appointmentScheduler: {
    id: 'assistant-003',
    tenant_id: tenantFixtures.defaultTenant.id,
    name: 'Appointment Scheduler',
    voice_id: 'echo',
    prompt_template: 'You are an appointment scheduling agent.',
    status: 'active',
  },
};

export const sessionFixtures = {
  activeSession: {
    id: 'session-001',
    tenant_id: tenantFixtures.defaultTenant.id,
    assistant_id: assistantFixtures.customerSupport.id,
    user_id: userFixtures.endUser.id,
    status: 'active',
    context: {
      messages: [
        { role: 'user', content: 'Olá!' },
        { role: 'assistant', content: 'Olá! Como posso ajudar?' },
      ],
      topic: 'greeting',
      variables: {
        userName: 'John',
      },
    },
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  closedSession: {
    id: 'session-002',
    tenant_id: tenantFixtures.defaultTenant.id,
    assistant_id: assistantFixtures.customerSupport.id,
    user_id: userFixtures.endUser.id,
    status: 'closed',
    context: {
      messages: [
        { role: 'user', content: 'Obrigado pela ajuda!' },
        { role: 'assistant', content: 'De nada!' },
      ],
    },
    started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    updated_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    ended_at: new Date(Date.now() - 900000).toISOString(), // 15 min ago
  },
};

export const messageFixtures = {
  textMessage: {
    id: 'msg-001',
    session_id: sessionFixtures.activeSession.id,
    role: 'user',
    content: 'Como posso cancelar meu plano?',
    audio_url: null,
    created_at: new Date().toISOString(),
  },
  voiceMessage: {
    id: 'msg-002',
    session_id: sessionFixtures.activeSession.id,
    role: 'user',
    content: null,
    audio_url: 'https://api.openai.com/v1/audio/speech/abc123',
    created_at: new Date().toISOString(),
  },
  assistantMessage: {
    id: 'msg-003',
    session_id: sessionFixtures.activeSession.id,
    role: 'assistant',
    content: 'Para cancelar seu plano, acesse: cham.ai/account/cancel',
    audio_url: null,
    created_at: new Date().toISOString(),
  },
};

export const callFixtures = {
  inboundCall: {
    id: 'call-001',
    tenant_id: tenantFixtures.defaultTenant.id,
    session_id: sessionFixtures.activeSession.id,
    assistant_id: assistantFixtures.customerSupport.id,
    direction: 'inbound',
    phone_number: '+5511988888888',
    status: 'answered',
    duration_seconds: 125,
    recording_url: 'https://api.twilio.com/recordings/abc123.mp3',
    transcription: 'Olá! Como posso ajudar?',
    created_at: new Date().toISOString(),
  },
  outboundCall: {
    id: 'call-002',
    tenant_id: tenantFixtures.defaultTenant.id,
    assistant_id: assistantFixtures.salesQualifier.id,
    direction: 'outbound',
    phone_number: '+5511999999999',
    status: 'completed',
    duration_seconds: 85,
    created_at: new Date(Date.now() - 300000).toISOString(),
    updated_at: new Date.now().toISOString(),
  },
};
