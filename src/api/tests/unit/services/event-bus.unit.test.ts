import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, type CallEvent } from '../../../src/services/event-bus.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  function makeEvent(overrides: Partial<CallEvent> = {}): CallEvent {
    return {
      type: 'call.status_changed',
      tenantId: 'tenant-1',
      callId: 'call-1',
      payload: { status: 'in_progress' },
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  describe('publish/subscribe (local)', () => {
    it('delivers event to subscriber', async () => {
      const received: CallEvent[] = [];
      bus.subscribe('cham-ai:calls:tenant-1', (e) => received.push(e));

      const event = makeEvent();
      await bus.publish(event);

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('call.status_changed');
      expect(received[0].callId).toBe('call-1');
    });

    it('delivers to both tenant and global channels', async () => {
      const tenantEvents: CallEvent[] = [];
      const globalEvents: CallEvent[] = [];
      bus.subscribe('cham-ai:calls:tenant-1', (e) => tenantEvents.push(e));
      bus.subscribe('cham-ai:calls:global', (e) => globalEvents.push(e));

      await bus.publish(makeEvent());

      expect(tenantEvents).toHaveLength(1);
      expect(globalEvents).toHaveLength(1);
    });

    it('does not deliver to other tenant channels', async () => {
      const received: CallEvent[] = [];
      bus.subscribe('cham-ai:calls:tenant-2', (e) => received.push(e));

      await bus.publish(makeEvent({ tenantId: 'tenant-1' }));

      expect(received).toHaveLength(0);
    });

    it('supports multiple subscribers on same channel', async () => {
      const received1: CallEvent[] = [];
      const received2: CallEvent[] = [];
      bus.subscribe('cham-ai:calls:tenant-1', (e) => received1.push(e));
      bus.subscribe('cham-ai:calls:tenant-1', (e) => received2.push(e));

      await bus.publish(makeEvent());

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('unsubscribe stops receiving events', async () => {
      const received: CallEvent[] = [];
      const unsub = bus.subscribe('cham-ai:calls:tenant-1', (e) => received.push(e));

      await bus.publish(makeEvent());
      expect(received).toHaveLength(1);

      unsub();
      await bus.publish(makeEvent({ callId: 'call-2' }));
      expect(received).toHaveLength(1); // Still 1
    });

    it('handles subscriber errors gracefully', async () => {
      bus.subscribe('cham-ai:calls:tenant-1', () => {
        throw new Error('Subscriber error');
      });
      const received: CallEvent[] = [];
      bus.subscribe('cham-ai:calls:tenant-1', (e) => received.push(e));

      // Should not throw
      await bus.publish(makeEvent());
      expect(received).toHaveLength(1);
    });
  });

  describe('with Redis', () => {
    it('publishes to Redis when available', async () => {
      const mockPublish = vi.fn().mockResolvedValue(undefined);
      const redisBus = new EventBus({ publish: mockPublish });

      const event = makeEvent();
      await redisBus.publish(event);

      expect(mockPublish).toHaveBeenCalledTimes(2);
      expect(mockPublish).toHaveBeenCalledWith(
        'cham-ai:calls:tenant-1',
        expect.stringContaining('"call.status_changed"')
      );
      expect(mockPublish).toHaveBeenCalledWith(
        'cham-ai:calls:global',
        expect.stringContaining('"call.status_changed"')
      );
    });

    it('does not throw when Redis publish fails', async () => {
      const mockPublish = vi.fn().mockRejectedValue(new Error('Redis down'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const redisBus = new EventBus({ publish: mockPublish });
      // Should not throw
      await redisBus.publish(makeEvent());

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('utilities', () => {
    it('getChannels returns active channels', () => {
      bus.subscribe('cham-ai:calls:tenant-1', () => {});
      bus.subscribe('cham-ai:calls:tenant-2', () => {});

      const channels = bus.getChannels();
      expect(channels).toContain('cham-ai:calls:tenant-1');
      expect(channels).toContain('cham-ai:calls:tenant-2');
    });

    it('getSubscriberCount returns count per channel', () => {
      bus.subscribe('cham-ai:calls:tenant-1', () => {});
      bus.subscribe('cham-ai:calls:tenant-1', () => {});

      expect(bus.getSubscriberCount('cham-ai:calls:tenant-1')).toBe(2);
      expect(bus.getSubscriberCount('cham-ai:calls:nonexistent')).toBe(0);
    });
  });

  describe('event types', () => {
    const validTypes = ['call.created', 'call.updated', 'call.status_changed', 'call.ended'];

    it.each(validTypes)('supports event type: %s', async (type) => {
      const received: CallEvent[] = [];
      bus.subscribe('cham-ai:calls:tenant-1', (e) => received.push(e));

      await bus.publish(makeEvent({ type: type as CallEvent['type'] }));
      expect(received[0].type).toBe(type);
    });
  });
});
