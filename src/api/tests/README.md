# Cham.ai API - Testing Documentation

## Overview

This document describes the testing strategy for the Cham.ai API project.

## Test Structure

```
tests/
├── unit/              # Unit tests (not yet implemented)
├── integration/       # Integration tests
│   ├── sessions.integration.test.ts
│   ├── assistants.integration.test.ts
│   └── messages.integration.test.ts
├── e2e/              # End-to-end tests
│   ├── voice.e2e.test.ts
│   └── assistants.e2e.test.ts
├── mocks/            # External API mocks
│   ├── openai.mock.ts
│   └── twilio.mock.ts
├── fixtures/         # Test data fixtures
│   └── fixtures.ts
└── helpers/          # Test utilities
    └── test-db.ts
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Types
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Coverage Targets

The project aims for **80% code coverage** across all modules:
- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

## Integration Tests

Integration tests use `better-sqlite3` in-memory database to test repository operations without requiring a full PostgreSQL setup.

### Setup

The `test-db.ts` helper provides:
- `createTestDatabase()`: Creates an in-memory SQLite database
- `initChamAISchema()`: Initializes the complete Cham.ai schema
- `seed()`: Populates the database with test data

### Example

```typescript
import { createTestDatabase, initChamAISchema } from '../helpers/test-db.js';

describe('Sessions Repository', () => {
  let testDb = createTestDatabase();

  beforeAll(() => {
    initChamAISchema(testDb.db);
  });

  it('should create a session', () => {
    // Test implementation
  });
});
```

## E2E Tests

E2E tests use Fastify's `inject()` method to test HTTP endpoints without starting a real server.

### Example

```typescript
import { createServer } from '../../src/server.js';

describe('Voice E2E', () => {
  let server;

  beforeAll(async () => {
    server = await createServer();
  });

  it('should return 401 without auth', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/voice/converse',
      payload: { text: 'Hello' },
    });

    expect(response.statusCode).toBe(401);
  });
});
```

## Mocks

External API mocks simulate responses from third-party services:

### OpenAI Mock

The OpenAI mock simulates AI service responses:
- `chat()`: Simulates GPT-4o chat completions
- `transcribe()`: Simulates Whisper transcription
- `createSpeech()`: Simulates TTS audio generation
- `setCustomResponse()`: Set custom test responses

### Twilio Mock

The Twilio mock simulates voice and SMS services:
- `createCall()`: Create outbound calls
- `getCall()`: Get call details
- `endCall()`: End an active call
- `generateTwiML()`: Generate TwiML for call handling
- `sendSMS()`: Send SMS messages

## Fixtures

Test fixtures provide consistent test data across all test files:

- `tenantFixtures`: Tenant data
- `userFixtures`: User data
- `assistantFixtures`: AI assistant data
- `sessionFixtures`: Chat session data
- `messageFixtures`: Message data
- `callFixtures`: Voice call data

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Use `beforeEach` to reset database state
3. **Descriptive Names**: Use clear, descriptive test names
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Mock External Services**: Always mock external APIs
6. **Test Edge Cases**: Don't just test the happy path
7. **Multi-tenancy**: Always verify tenant isolation

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Push to main branch
- Before deployment

Coverage reports are generated and can be found in `coverage/` directory.
