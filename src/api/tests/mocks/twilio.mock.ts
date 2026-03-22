/**
 * Twilio API Mock
 *
 * Mock para testes de integração com Twilio API (Voice Calls, SIP Trunking, SMS)
 */

import { vi } from 'vitest';

export interface CallInstance {
  sid: string;
  parentCallSid?: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  from: string;
  to: string;
  direction: 'inbound' | 'outbound' | 'outbound-dial';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  price?: number;
  priceUnit?: string;
  recordingUrl?: string;
  transcription?: string;
}

export class TwilioMock {
  private calls: Map<string, CallInstance> = new Map();
  private messages: Map<string, any> = new Map();
  private recordings: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Add some default test calls
    this.calls.set('CA-test-1', {
      sid: 'CA-test-1',
      status: 'completed',
      from: '+5511988888888',
      to: '+5511999999999',
      direction: 'inbound',
      startTime: new Date(Date.now() - 300000),
      endTime: new Date(Date.now() - 180000),
      duration: 120,
      price: 0.05,
      priceUnit: 'USD',
      recordingUrl: 'https://api.twilio.com/recordings/CA-test-1.mp3',
      transcription: 'Olá! Como posso ajudar?',
    });

    this.calls.set('CA-test-2', {
      sid: 'CA-test-2',
      status: 'in-progress',
      from: '+5511999999999',
      to: '+5511988888888',
      direction: 'outbound',
      startTime: new Date(Date.now() - 60000),
    });
  }

  /**
   * Simulate creating an outbound call
   */
  async createCall(params: {
    to: string;
    from: string;
    url?: string;
    twiml?: string;
    statusCallback?: string;
  }): Promise<CallInstance> {
    const sid = `CA-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const call: CallInstance = {
      sid,
      status: 'queued',
      from: params.from,
      to: params.to,
      direction: 'outbound',
      startTime: undefined,
      endTime: undefined,
      duration: 0,
    };

    this.calls.set(sid, call);

    // Simulate call progression
    setTimeout(() => {
      call.status = 'ringing';
    }, 100);

    setTimeout(() => {
      call.status = 'in-progress';
      call.startTime = new Date();
    }, 500);

    return call;
  }

  /**
   * Get call details
   */
  async getCall(sid: string): Promise<CallInstance | null> {
    return this.calls.get(sid) || null;
  }

  /**
   * Update call status
   */
  async updateCallStatus(sid: string, status: CallInstance['status']): Promise<void> {
    const call = this.calls.get(sid);
    if (!call) {
      throw new Error(`Call ${sid} not found`);
    }

    call.status = status;

    if (status === 'completed' && !call.endTime) {
      call.endTime = new Date();
      if (call.startTime) {
        call.duration = Math.floor((call.endTime.getTime() - call.startTime.getTime()) / 1000);
      }
    }
  }

  /**
   * End a call
   */
  async endCall(sid: string): Promise<void> {
    await this.updateCallStatus(sid, 'completed');
  }

  /**
   * Get call recording
   */
  async getRecording(callSid: string): Promise<string | null> {
    const call = this.calls.get(callSid);
    return call?.recordingUrl || null;
  }

  /**
   * Add recording to call
   */
  async addRecording(callSid: string, recordingUrl: string, transcription?: string): Promise<void> {
    const call = this.calls.get(callSid);
    if (call) {
      call.recordingUrl = recordingUrl;
      if (transcription) {
        call.transcription = transcription;
      }
    }
  }

  /**
   * Generate TwiML for call handling
   */
  generateTwiML(params: {
    gather?: boolean;
    say?: string;
    play?: string;
    redirect?: string;
    hangup?: boolean;
  }): string {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (params.gather) {
      twiml += '<Gather action="/voice/gather" method="POST" numDigits="1" timeout="5">';
      if (params.say) {
        twiml += `<Say language="pt-BR" voice="female">${params.say}</Say>`;
      }
      twiml += '</Gather>';
    } else if (params.say) {
      twiml += `<Say language="pt-BR" voice="female">${params.say}</Say>`;
    }

    if (params.play) {
      twiml += `<Play>${params.play}</Play>`;
    }

    if (params.redirect) {
      twiml += `<Redirect>${params.redirect}</Redirect>`;
    }

    if (params.hangup) {
      twiml += '<Hangup />';
    }

    twiml += '</Response>';
    return twiml;
  }

  /**
   * Create SIP trunk
   */
  async createSipTrunk(params: {
    friendlyName: string;
    domain: string;
    voiceUrl: string;
  }): Promise<any> {
    return {
      sid: `TK-${Date.now()}`,
      friendlyName: params.friendlyName,
      domain: params.domain,
      voiceUrl: params.voiceUrl,
      status: 'active',
    };
  }

  /**
   * Send SMS
   */
  async sendSMS(params: {
    to: string;
    from: string;
    body: string;
  }): Promise<any> {
    const sid = `SM-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const message = {
      sid,
      to: params.to,
      from: params.from,
      body: params.body,
      status: 'queued',
      direction: 'outbound',
      createdAt: new Date(),
    };

    this.messages.set(sid, message);

    // Simulate delivery
    setTimeout(() => {
      message.status = 'sent';
    }, 100);

    setTimeout(() => {
      message.status = 'delivered';
    }, 500);

    return message;
  }

  /**
   * Get SMS details
   */
  async getSMS(sid: string): Promise<any> {
    return this.messages.get(sid) || null;
  }

  /**
   * Get all calls
   */
  async getAllCalls(filter?: { status?: CallInstance['status']; to?: string; from?: string }): Promise<CallInstance[]> {
    let calls = Array.from(this.calls.values());

    if (filter?.status) {
      calls = calls.filter((c) => c.status === filter.status);
    }
    if (filter?.to) {
      calls = calls.filter((c) => c.to === filter.to);
    }
    if (filter?.from) {
      calls = calls.filter((c) => c.from === filter.from);
    }

    return calls;
  }

  /**
   * Reset all mock data
   */
  reset(): void {
    this.calls.clear();
    this.messages.clear();
    this.recordings.clear();
    this.initializeDefaultData();
  }

  /**
   * Set custom response for testing
   */
  setCall(sid: string, call: CallInstance): void {
    this.calls.set(sid, call);
  }
}

// Singleton instance
export const twilioMock = new TwilioMock();

// Vitest mock for Twilio SDK
vi.mock('twilio', () => ({
  default: vi.fn().mockImplementation(() => ({
    calls: {
      create: vi.fn().mockResolvedValue({
        sid: 'CA-test-123',
        status: 'queued',
        from: '+5511988888888',
        to: '+5511999999999',
        direction: 'outbound',
      }),
      get: vi.fn().mockResolvedValue({
        sid: 'CA-test-123',
        status: 'completed',
        duration: 120,
      }),
      list: vi.fn().mockResolvedValue([
        {
          sid: 'CA-test-1',
          status: 'completed',
          from: '+5511988888888',
          to: '+5511999999999',
          duration: 120,
        },
      ]),
    },
    messages: {
      create: vi.fn().mockResolvedValue({
        sid: 'SM-test-123',
        status: 'queued',
        body: 'Test message',
      }),
      get: vi.fn().mockResolvedValue({
        sid: 'SM-test-123',
        status: 'delivered',
        body: 'Test message',
      }),
    },
    recordings: {
      create: vi.fn().mockResolvedValue({
        sid: 'RE-test-123',
        url: 'https://api.twilio.com/recordings/RE-test-123.mp3',
      }),
      get: vi.fn().mockResolvedValue({
        sid: 'RE-test-123',
        url: 'https://api.twilio.com/recordings/RE-test-123.mp3',
        duration: 120,
      }),
    },
  })),
}));
