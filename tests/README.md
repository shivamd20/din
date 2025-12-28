# Integration Tests

This directory contains integration tests for the DIN application. These tests run against a live dev server and test the full stack.

## Setup

1. Install test dependencies:
```bash
npm install --save-dev vitest @vitest/ui
```

2. Make sure the dev server can run (all dependencies installed)

## Running Tests

Run all tests:
```bash
npm run test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with UI:
```bash
npm run test:ui
```

## Test Structure

- `setup.ts` - Handles starting/stopping the dev server
- `utils/` - Test utilities (auth bypass, tRPC client)
- `integration/` - Integration test suites

## Test Mode Auth Bypass

Tests use a special header (`X-Test-Mode: true` and `X-Test-User-Id`) to bypass authentication. The server checks for these headers and uses the test user ID directly.

## Writing New Tests

1. Import the test utilities:
```typescript
import { createTestTRPCClient, TEST_USER } from '../utils/trpc-client';
```

2. Create a test client:
```typescript
const client = createTestTRPCClient();
```

3. Write your tests using the tRPC client:
```typescript
it('should do something', async () => {
    const result = await client.someProcedure.query({ ... });
    expect(result).toBeDefined();
});
```

## Notes

- Tests automatically start/stop the dev server
- Tests use a dedicated test user ID
- Tests include delays for async operations (workflows, LLM calls)
- The dev server must be able to start successfully for tests to run

