/**
 * EventBus — Redis-backed pub/sub for real-time call events
 *
 * Publishes call lifecycle events (created, updated, status_changed, ended)
 * to Redis channels. The SSE endpoint subscribes and forwards to clients.
 *
 * Channels:
 *   cham-ai:calls:{tenant_id}  — All events for a tenant's calls
 *   cham-ai:calls:global       — All events (for admin/observability)
 *
 * Event format:
 *   { type: "call.status_changed", tenantId, callId, payload, timestamp }
 */

export interface CallEvent {
  type: 'call.created' | 'call.updated' | 'call.status_changed' | 'call.ended'
    | 'transcription.partial' | 'transcription.final';
  tenantId: string;
  callId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

type Subscriber = (event: CallEvent) => void;

/**
 * In-memory event bus with optional Redis publish.
 *
 * When Redis is available, events are published to Redis channels
 * so multiple server instances can share events.
 *
 * When Redis is not available, events are broadcast locally only
 * (single-instance mode — suitable for development).
 */
export class EventBus {
  private redis: any;
  private subscribers: Map<string, Set<Subscriber>> = new Map();

  constructor(redis?: any) {
    this.redis = redis;
  }

  /**
   * Publish a call event.
   * Always broadcasts locally. Publishes to Redis if available.
   */
  async publish(event: CallEvent): Promise<void> {
    const channel = `cham-ai:calls:${event.tenantId}`;
    const globalChannel = 'cham-ai:calls:global';
    const serialized = JSON.stringify(event);

    // Local broadcast
    this.broadcast(channel, event);
    this.broadcast(globalChannel, event);

    // Redis publish (for multi-instance)
    if (this.redis) {
      try {
        await this.redis.publish(channel, serialized);
        await this.redis.publish(globalChannel, serialized);
      } catch (err) {
        // Redis publish failure is non-critical
        console.error('[EventBus] Redis publish failed:', err);
      }
    }
  }

  /**
   * Subscribe to events for a channel.
   * Returns an unsubscribe function.
   */
  subscribe(channel: string, callback: Subscriber): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);

    return () => {
      this.subscribers.get(channel)?.delete(callback);
    };
  }

  /**
   * Subscribe to Redis pub/sub for a channel.
   * Call this once per channel per server instance.
   * Returns an unsubscribe function.
   */
  async subscribeRedis(channel: string, callback: Subscriber): Promise<() => void> {
    if (!this.redis) {
      // Fall back to local-only
      return this.subscribe(channel, callback);
    }

    const handler = (message: string) => {
      try {
        const event: CallEvent = JSON.parse(message);
        callback(event);
      } catch {
        // Ignore malformed messages
      }
    };

    try {
      await this.redis.subscribe(channel);
      this.redis.on('message', (ch: string, msg: string) => {
        if (ch === channel) handler(msg);
      });
    } catch (err) {
      console.error(`[EventBus] Redis subscribe failed for ${channel}:`, err);
    }

    return () => {
      this.redis.unsubscribe(channel).catch(() => {});
    };
  }

  /**
   * Get all active channel names.
   */
  getChannels(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Get subscriber count for a channel.
   */
  getSubscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size ?? 0;
  }

  private broadcast(channel: string, event: CallEvent): void {
    const subs = this.subscribers.get(channel);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(event);
        } catch (err) {
          console.error('[EventBus] Subscriber error:', err);
        }
      }
    }
  }
}
