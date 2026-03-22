# ClawdTalk Integration

## Overview

Cham.ai integrates with [ClawdTalk](https://www.clawdtalk.com/) to enable voice calling capabilities through WebSocket-based real-time communication.

## Architecture

```
┌─────────────┐      WebSocket      ┌──────────────┐      ┌─────────────┐
│  ClawdTalk  │ ◄─────────────────────► │  Cham.ai    │ ◄────► │  OpenAI     │
│  (Telnyx)   │    JSON events        │  API         │        │  (LLM)      │
└─────────────┘                       └──────────────┘        └─────────────┘
     Voz                                         |
     ▼                                          ▼
  Phone Call                                  Sessions
```

## Features

- **Two-way calling** - Receive calls from your Cham.ai bot
- **HD Voice** - Wideband audio quality with AMR-WB codec
- **Global network** - Sub-100ms latency with 99.999% uptime
- **WebSocket connection** - Keeps your bot private behind firewalls/NAT
- **Session management** - Track active calls and conversation history

## Endpoints

### WebSocket Endpoint

```
WS /api/v1/clawdtalk/webhook
```

Main WebSocket endpoint for ClawdTalk integration.

### Health Check

```
GET /api/v1/clawdtalk/status
```

Returns service status and active call count.

## Message Format

### Incoming Events (from ClawdTalk)

```typescript
{
  call_id: string;        // Unique call identifier
  text?: string;          // User speech transcribed (for 'speech' events)
  timestamp: string;      // ISO timestamp
  sequence: number;       // Event sequence number
  event: 'start' | 'speech' | 'end' | 'error' | 'hangup';
  pin_verified?: boolean; // For PIN-protected calls
}
```

### Outgoing Responses (to ClawdTalk)

```typescript
{
  type: 'response' | 'error' | 'hangup';
  call_id: string;
  text?: string;         // AI response to speak
  sequence?: number;     // Echo incoming sequence
  error?: string;        // Error message for error responses
}
```

## Event Types

### `start`
New call initiated. Respond with a greeting message.

### `speech`
User spoke something. Process with AI and respond.

### `end` / `hangup`
Call ended. Clean up session data.

### `error`
Error occurred. Send error response.

## Configuration

### Environment Variables (Optional)

```bash
# ClawdTalk configuration (if needed in the future)
CLAWDTALK_WEBHOOK_URL=https://api.clawdtalk.com/webhook
CLAWDTALK_API_KEY=your_api_key_here
```

## Usage Example

### Connecting to ClawdTalk

1. **Configure ClawdTalk** to point to your Cham.ai server:
   ```
   wss://your-cham-ai-server.com/api/v1/clawdtalk/webhook
   ```

2. **ClawdTalk connects** via WebSocket

3. **Call starts** - Cham.ai receives `start` event
4. **User speaks** - Cham.ai receives `speech` event with transcribed text
5. **Cham.ai processes** - Sends text to AI, gets response
6. **Cham.ai responds** - Sends `response` with AI text
7. **ClawdTalk speaks** - Converts text to speech for caller
8. **Call ends** - Cham.ai receives `end` event

### Example Flow

```javascript
// 1. Call starts
{
  "call_id": "call-abc123",
  "timestamp": "2024-01-01T12:00:00Z",
  "sequence": 1,
  "event": "start"
}

// Response
{
  "type": "response",
  "call_id": "call-abc123",
  "text": "Hello! This is Cham.ai. How can I help you today?",
  "sequence": 1
}

// 2. User speaks
{
  "call_id": "call-abc123",
  "text": "What time is it?",
  "timestamp": "2024-01-01T12:00:05Z",
  "sequence": 2,
  "event": "speech"
}

// Response
{
  "type": "response",
  "call_id": "call-abc123",
  "text": "The current time is 12:00 PM.",
  "sequence": 2
}

// 3. Call ends
{
  "call_id": "call-abc123",
  "timestamp": "2024-01-01T12:00:15Z",
  "sequence": 3,
  "event": "end"
}
```

## Session Management

Active calls are tracked in memory (use Redis in production):

```typescript
interface ActiveCall {
  startTime: Date;
  lastActivity: Date;
  session_id?: string;
  assistant_id?: string;
  messages: Array<{ role: string; content: string }>;
}
```

Calls are automatically cleaned up after 1 hour of inactivity.

## AI Integration

The `processAIResponse` function handles conversation with the AI. In production:

1. Integrate with your AI service (OpenAI, Anthropic, etc.)
2. Maintain conversation context across turns
3. Support multiple assistants/personas
4. Add streaming responses for faster TTS

## Testing

### Unit Tests
```bash
npm run test -- tests/unit/routes/clawdtalk.route.unit.test.ts
```

### Integration Tests
Integration tests require actual WebSocket connection. Create in:
`tests/integration/clawdtalk.integration.test.ts`

## Production Considerations

1. **Redis** - Use Redis for session storage across multiple instances
2. **Rate Limiting** - Limit concurrent calls based on your plan
3. **Authentication** - Add API key authentication for the webhook
4. **Logging** - Log all calls for analytics and debugging
5. **Monitoring** - Track call duration, success rate, and latency
6. **PIN Protection** - Enable PIN for sensitive operations
7. **Error Handling** - Gracefully handle network failures

## Pricing

ClawdTalk offers several tiers:

| Plan | Price | Minutes | Features |
|------|-------|---------|----------|
| Free | $0 | 10/month | Community support |
| Starter | $12/month | 100 | Dedicated phone number |
| Pro | $30/month | 500 | Recordings, summaries |

Visit [clawdtalk.com](https://www.clawdtalk.com/) for more details.

## Troubleshooting

### WebSocket Connection Fails

- Check firewall rules allow WebSocket connections
- Verify the URL is correct: `wss://your-domain.com/api/v1/clawdtalk/webhook`
- Check SSL certificate is valid

### No Response From Bot

- Check server logs for errors
- Verify AI service is accessible
- Check `call_id` matches in request and response

### Call Drops Unexpectedly

- Check network connectivity
- Verify call timeout settings
- Check session cleanup interval

## Future Enhancements

- [ ] Add Redis-based session storage
- [ ] Support multiple assistants
- [ ] Add call recording integration
- [ ] Implement streaming responses
- [ ] Add analytics dashboard
- [ ] Support multiple languages
- [ ] Add voice activity detection
