# Mock Adapter for TanStack AI

A mock provider adapter that allows you to use the app offline without an actual LLM provider. This is useful for development, testing, and when you don't have API keys configured.

## Usage

The mock adapter is automatically enabled when:
1. The `USE_MOCK_ADAPTER` environment variable is set to `'true'`, OR
2. The `GEMINI_API_KEY` is missing/not configured

### Environment Variables

Add these to your `wrangler.jsonc` or `.dev.vars`:

```jsonc
{
  "vars": {
    "USE_MOCK_ADAPTER": "true",           // Enable mock adapter
    "USE_MOCK_ADAPTER_DEBUG": "true"      // Enable debug logging (optional)
  }
}
```

Or set them in your environment:
```bash
export USE_MOCK_ADAPTER=true
export USE_MOCK_ADAPTER_DEBUG=true  # Optional
```

### Features

- ✅ **Streaming Support**: Simulates token-by-token streaming responses
- ✅ **Structured Output**: Supports Zod schemas for structured data extraction
- ✅ **Configurable Delays**: Simulates realistic network latency
- ✅ **Custom Responses**: Can be configured with custom response generators
- ✅ **Debug Logging**: Optional debug mode for development

### How It Works

The mock adapter:
- Returns reflective responses based on user input
- Simulates streaming by chunking responses word-by-word
- Handles structured output requests (like signal extraction)
- Provides realistic delays to simulate network conditions

### Example Responses

- **Regular chat**: Returns reflective responses like "I hear you saying: [user message]. That's interesting..."
- **Signal extraction**: Returns mock structured data with all signals set to 0.5
- **Tool requests**: Acknowledges tool usage requests

### Customization

You can customize the mock adapter behavior by modifying the `responseGenerator` in `server/ai-model.ts`:

```typescript
responseGenerator: (messages) => {
    // Your custom logic here
    return "Custom response";
}
```

### Disabling Mock Mode

To use the real Gemini adapter:
1. Set `USE_MOCK_ADAPTER` to `'false'` or remove it
2. Ensure `GEMINI_API_KEY` is configured

The adapter will automatically fall back to the real provider when the API key is present and mock mode is disabled.

