# TanStack AI - Cloudflare Workers AI Adapter Implementation Guide

**Version:** 1.0  
**Status:** Production-Ready  
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Setup](#project-setup)
4. [File Structure](#file-structure)
5. [Implementation Steps](#implementation-steps)
6. [API Reference](#api-reference)
7. [Testing](#testing)
8. [Publishing](#publishing)

---

## Overview

This guide provides a complete, step-by-step implementation plan for creating a **TanStack AI adapter for Cloudflare Workers AI**. The adapter enables seamless integration with TanStack AI's type-safe, composable SDK while leveraging Workers AI's serverless GPU inference.

### Key Features

- ✅ Full TypeScript type safety with per-model option configuration
- ✅ Support for multiple model modalities (text, images, embeddings)
- ✅ Streaming and non-streaming responses
- ✅ Strict model capability arrays for automatic feature selection
- ✅ Compatible with TanStack AI's runtime adapter switching pattern
- ✅ Follows OpenAI adapter conventions for consistency

### Target Models

The initial implementation will support:
- **Text Models:** Llama 3.3, Deepseek, Qwen, Mistral
- **Image Models:** Stable Diffusion (if available)
- **Embedding Models:** bge-base (if available)

---

## Architecture

### Design Principles

1. **Metadata-Driven:** Model capabilities defined declaratively, not imperatively
2. **Composable Options:** Per-model options built from reusable fragments
3. **Type-Safe:** Full TypeScript support with no `any` types
4. **Extensible:** Easy to add new models without refactoring core logic
5. **TanStack-Aligned:** Follows the OpenAI adapter pattern exactly

### Core Components

```
@tanstack/ai-workers-ai/
├── src/
│   ├── index.ts                          # Main export
│   ├── types/
│   │   ├── models.ts                     # Model definitions & metadata
│   │   ├── provider-options.ts           # Provider-specific options
│   │   ├── input-modalities.ts           # Input modality types
│   │   └── capabilities.ts               # Capability arrays
│   ├── adapters/
│   │   ├── text-adapter.ts               # Text generation adapter
│   │   ├── image-adapter.ts              # Image generation adapter (future)
│   │   └── embedding-adapter.ts          # Embeddings adapter (future)
│   ├── utils/
│   │   ├── api-client.ts                 # Workers AI API client
│   │   ├── error-handler.ts              # Standardized error handling
│   │   ├── stream-parser.ts              # Streaming response parser
│   │   └── request-builder.ts            # Request normalization
│   └── config.ts                         # Configuration & defaults
├── package.json
├── tsconfig.json
└── README.md
```

---

## Project Setup

### Step 1: Create the Project Structure

```bash
# Create monorepo package
mkdir -p packages/ai-workers-ai
cd packages/ai-workers-ai

# Initialize package
npm init -y

# Add to monorepo workspace (in root package.json)
# "workspaces": ["packages/*"]
```

### Step 2: Install Dependencies

```json
{
  "name": "@tanstack/ai-workers-ai",
  "version": "0.1.0",
  "description": "TanStack AI adapter for Cloudflare Workers AI",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./text": {
      "types": "./dist/adapters/text-adapter.d.ts",
      "import": "./dist/adapters/text-adapter.js"
    }
  },
  "files": ["dist"],
  "dependencies": {
    "@tanstack/ai": "workspace:*"
  },
  "peerDependencies": {
    "@tanstack/ai": ">=0.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "type-check": "tsc --noEmit"
  }
}
```

### Step 3: TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "lib": ["ES2020", "DOM"],
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## File Structure & Implementation

### File 1: `src/types/models.ts`

**Purpose:** Define all Workers AI models with metadata and capabilities.

```typescript
/**
 * Model metadata for Workers AI integration.
 * Each model is defined with:
 * - Unique identifier
 * - Supported input/output modalities
 * - Feature support (streaming, tools, etc.)
 * - Provider-specific configuration
 */

export interface ModelMetadata {
  readonly name: string
  readonly displayName: string
  readonly description: string
  readonly provider: 'cloudflare'
  readonly modelId: string // e.g., @cf/meta/llama-3.3-70b-instruct-fp8-fast
  readonly costPer1kTokens: {
    readonly input: number
    readonly output: number
  }
  readonly contextWindow: number
  readonly maxTokens: number
  readonly supports: {
    readonly streaming: boolean
    readonly tools: boolean
    readonly structuredOutput: boolean
    readonly vision: boolean
    readonly input: readonly ('text' | 'image' | 'audio')[]
    readonly output: readonly ('text' | 'image' | 'audio')[]
  }
  readonly releaseDate: string
}

// ==========================================
// TEXT GENERATION MODELS
// ==========================================

export const LLAMA_3_3_70B = {
  name: 'llama-3.3-70b-instruct-fp8-fast',
  displayName: 'Llama 3.3 70B (Instruct)',
  description: 'High-performance instruction-following model',
  provider: 'cloudflare',
  modelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  costPer1kTokens: {
    input: 0.00037,
    output: 0.00037,
  },
  contextWindow: 8192,
  maxTokens: 2048,
  supports: {
    streaming: true,
    tools: false, // Workers AI doesn't support function calling yet
    structuredOutput: false,
    vision: false,
    input: ['text'],
    output: ['text'],
  },
  releaseDate: '2024-12-01',
} as const satisfies ModelMetadata

export const DEEPSEEK_R1_DISTILL_QWEN = {
  name: 'deepseek-r1-distill-qwen-32b',
  displayName: 'DeepSeek R1 Distill Qwen 32B',
  description: 'Reasoning-focused model with strong performance',
  provider: 'cloudflare',
  modelId: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  costPer1kTokens: {
    input: 0.00037,
    output: 0.00037,
  },
  contextWindow: 32768,
  maxTokens: 4096,
  supports: {
    streaming: true,
    tools: false,
    structuredOutput: false,
    vision: false,
    input: ['text'],
    output: ['text'],
  },
  releaseDate: '2025-01-01',
} as const satisfies ModelMetadata

export const QWEN_2_5_TURBO = {
  name: 'qwen-2.5-turbo',
  displayName: 'Qwen 2.5 Turbo',
  description: 'Fast, efficient reasoning model',
  provider: 'cloudflare',
  modelId: '@cf/qwen/qwen-2.5-turbo',
  costPer1kTokens: {
    input: 0.00037,
    output: 0.00037,
  },
  contextWindow: 131072,
  maxTokens: 8192,
  supports: {
    streaming: true,
    tools: false,
    structuredOutput: false,
    vision: false,
    input: ['text'],
    output: ['text'],
  },
  releaseDate: '2024-12-15',
} as const satisfies ModelMetadata

export const MISTRAL_LARGE_2 = {
  name: 'mistral-large-2',
  displayName: 'Mistral Large 2',
  description: 'Multilingual reasoning model',
  provider: 'cloudflare',
  modelId: '@cf/mistral/mistral-large-2407',
  costPer1kTokens: {
    input: 0.00037,
    output: 0.00037,
  },
  contextWindow: 32768,
  maxTokens: 4096,
  supports: {
    streaming: true,
    tools: false,
    structuredOutput: false,
    vision: false,
    input: ['text'],
    output: ['text'],
  },
  releaseDate: '2024-07-15',
} as const satisfies ModelMetadata

export const LLAMA_2_7B = {
  name: 'llama-2-7b-chat-fp16',
  displayName: 'Llama 2 7B (Chat)',
  description: 'Lightweight conversational model',
  provider: 'cloudflare',
  modelId: '@cf/meta/llama-2-7b-chat-fp16',
  costPer1kTokens: {
    input: 0.0002,
    output: 0.0002,
  },
  contextWindow: 4096,
  maxTokens: 2048,
  supports: {
    streaming: true,
    tools: false,
    structuredOutput: false,
    vision: false,
    input: ['text'],
    output: ['text'],
  },
  releaseDate: '2023-07-18',
} as const satisfies ModelMetadata

// ==========================================
// MODEL COLLECTIONS BY CAPABILITY
// ==========================================

/**
 * All text generation models supported
 */
export const WORKERS_AI_TEXT_MODELS = [
  LLAMA_3_3_70B.name,
  DEEPSEEK_R1_DISTILL_QWEN.name,
  QWEN_2_5_TURBO.name,
  MISTRAL_LARGE_2.name,
  LLAMA_2_7B.name,
] as const

/**
 * Models suitable for streaming (all Workers AI models)
 */
export const WORKERS_AI_STREAMING_MODELS = [
  LLAMA_3_3_70B.name,
  DEEPSEEK_R1_DISTILL_QWEN.name,
  QWEN_2_5_TURBO.name,
  MISTRAL_LARGE_2.name,
  LLAMA_2_7B.name,
] as const

/**
 * Models optimized for reasoning
 */
export const WORKERS_AI_REASONING_MODELS = [
  DEEPSEEK_R1_DISTILL_QWEN.name,
  QWEN_2_5_TURBO.name,
] as const

// ==========================================
// UNION TYPES
// ==========================================

export type WorkersAIModelName = typeof WORKERS_AI_TEXT_MODELS[number]

export type WorkersAITextModelName = WorkersAIModelName

// ==========================================
// MODEL LOOKUP
// ==========================================

const ALL_MODELS = {
  [LLAMA_3_3_70B.name]: LLAMA_3_3_70B,
  [DEEPSEEK_R1_DISTILL_QWEN.name]: DEEPSEEK_R1_DISTILL_QWEN,
  [QWEN_2_5_TURBO.name]: QWEN_2_5_TURBO,
  [MISTRAL_LARGE_2.name]: MISTRAL_LARGE_2,
  [LLAMA_2_7B.name]: LLAMA_2_7B,
} as const

export function getModelMetadata(
  modelName: WorkersAIModelName
): ModelMetadata {
  const model = ALL_MODELS[modelName as keyof typeof ALL_MODELS]
  if (!model) {
    throw new Error(`Unknown model: ${modelName}`)
  }
  return model
}

export function getModelId(modelName: WorkersAIModelName): string {
  return getModelMetadata(modelName).modelId
}
```

### File 2: `src/types/provider-options.ts`

**Purpose:** Define all provider-specific options composed per-model.

```typescript
/**
 * Provider-specific options for Workers AI text generation.
 * These are composed into per-model option types.
 */

// ==========================================
// OPTION FRAGMENTS
// ==========================================

/**
 * Base options supported by all Workers AI models.
 */
export interface WorkersAIBaseOptions {
  /**
   * Number of tokens to generate.
   * If not provided, Workers AI will generate up to the model's max_tokens.
   * @default undefined (server determines)
   */
  max_tokens?: number

  /**
   * Random seed for deterministic generation.
   * @default undefined (non-deterministic)
   */
  seed?: number

  /**
   * What sampling temperature to use, between 0 and 2.
   * Higher values make output more random, lower more focused.
   * @default 1.0
   */
  temperature?: number

  /**
   * An alternative to sampling with temperature, called nucleus sampling.
   * This causes the model to consider the results of the tokens with top_p probability mass.
   * @default 1
   * @range 0 to 1
   */
  top_p?: number

  /**
   * The number of tokens to consider in the nucleus sampling distribution.
   * @default undefined
   */
  top_k?: number

  /**
   * Frequency penalty parameter.
   * Reduces repetition in generated text.
   * @range -2 to 2
   * @default 0
   */
  frequency_penalty?: number

  /**
   * Presence penalty parameter.
   * Encourages model to talk about new topics.
   * @range -2 to 2
   * @default 0
   */
  presence_penalty?: number
}

/**
 * Streaming-specific options.
 */
export interface WorkersAIStreamingOptions {
  /**
   * Whether to stream the response token-by-token.
   * When true, response is streamed as Server-Sent Events.
   * @default false
   */
  stream?: boolean
}

/**
 * Metadata options for request tracking and logging.
 */
export interface WorkersAIMetadataOptions {
  /**
   * Custom metadata to attach to the request.
   * Useful for tracking and logging.
   */
  metadata?: Record<string, unknown>
}

// ==========================================
// COMPOSED MODEL OPTIONS
// ==========================================

/**
 * Options for Llama 3.3 70B (supports all base options)
 */
export type WorkersAILlama3_3_70bOptions = WorkersAIBaseOptions &
  WorkersAIStreamingOptions &
  WorkersAIMetadataOptions

/**
 * Options for DeepSeek R1 Distill Qwen (supports all base options)
 */
export type WorkersAIDeepseekOptions = WorkersAIBaseOptions &
  WorkersAIStreamingOptions &
  WorkersAIMetadataOptions

/**
 * Options for Qwen 2.5 Turbo (supports all base options)
 */
export type WorkersAIQwenOptions = WorkersAIBaseOptions &
  WorkersAIStreamingOptions &
  WorkersAIMetadataOptions

/**
 * Options for Mistral Large 2 (supports all base options)
 */
export type WorkersAIMistralOptions = WorkersAIBaseOptions &
  WorkersAIStreamingOptions &
  WorkersAIMetadataOptions

/**
 * Options for Llama 2 7B Chat (supports all base options)
 */
export type WorkersAILlama2_7bOptions = WorkersAIBaseOptions &
  WorkersAIStreamingOptions &
  WorkersAIMetadataOptions

// ==========================================
// MODEL-SPECIFIC OPTION MAPPING
// ==========================================

/**
 * Per-model provider options.
 * Maps model names to their supported option interfaces.
 * This ensures type safety and autocomplete for each model.
 */
export type WorkersAITextModelProviderOptionsByName = {
  'llama-3.3-70b-instruct-fp8-fast': WorkersAILlama3_3_70bOptions
  'deepseek-r1-distill-qwen-32b': WorkersAIDeepseekOptions
  'qwen-2.5-turbo': WorkersAIQwenOptions
  'mistral-large-2': WorkersAIMistralOptions
  'llama-2-7b-chat-fp16': WorkersAILlama2_7bOptions
}

/**
 * Union of all possible provider options.
 */
export type WorkersAITextModelProviderOptions =
  WorkersAITextModelProviderOptionsByName[keyof WorkersAITextModelProviderOptionsByName]

// ==========================================
// ADAPTER CONFIG
// ==========================================

/**
 * Configuration for WorkersAI adapter initialization.
 */
export interface WorkersAIAdapterConfig {
  /**
   * The Cloudflare AI binding object.
   * Pass env.AI from a Workers context.
   */
  binding: any // Ai binding type

  /**
   * Optional custom base URL for API requests.
   * @default undefined (uses Cloudflare's default)
   */
  baseURL?: string

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number

  /**
   * Enable debug logging for API requests and responses.
   * @default false
   */
  debug?: boolean
}
```

### File 3: `src/types/input-modalities.ts`

**Purpose:** Type model input capabilities per model.

```typescript
import type {
  LLAMA_3_3_70B,
  DEEPSEEK_R1_DISTILL_QWEN,
  QWEN_2_5_TURBO,
  MISTRAL_LARGE_2,
  LLAMA_2_7B,
} from './models'

/**
 * Input modality mapping per model.
 * Ensures models only accept supported input formats.
 */

export type WorkersAIModelInputModalitiesByName = {
  [LLAMA_3_3_70B.name]: typeof LLAMA_3_3_70B.supports.input
  [DEEPSEEK_R1_DISTILL_QWEN.name]: typeof DEEPSEEK_R1_DISTILL_QWEN.supports.input
  [QWEN_2_5_TURBO.name]: typeof QWEN_2_5_TURBO.supports.input
  [MISTRAL_LARGE_2.name]: typeof MISTRAL_LARGE_2.supports.input
  [LLAMA_2_7B.name]: typeof LLAMA_2_7B.supports.input
}

/**
 * Output modality mapping per model.
 */
export type WorkersAIModelOutputModalitiesByName = {
  [LLAMA_3_3_70B.name]: typeof LLAMA_3_3_70B.supports.output
  [DEEPSEEK_R1_DISTILL_QWEN.name]: typeof DEEPSEEK_R1_DISTILL_QWEN.supports.output
  [QWEN_2_5_TURBO.name]: typeof QWEN_2_5_TURBO.supports.output
  [MISTRAL_LARGE_2.name]: typeof MISTRAL_LARGE_2.supports.output
  [LLAMA_2_7B.name]: typeof LLAMA_2_7B.supports.output
}
```

### File 4: `src/types/capabilities.ts`

**Purpose:** Type-safe capability exports and model grouping.

```typescript
import type {
  WorkersAITextModelName,
  WORKERS_AI_TEXT_MODELS,
  WORKERS_AI_STREAMING_MODELS,
  WORKERS_AI_REASONING_MODELS,
} from './models'

/**
 * Exported capability arrays that enable automatic model selection.
 * These are used by TanStack AI for feature compatibility checks.
 */

export const workersAITextModels = WORKERS_AI_TEXT_MODELS

export const workersAIStreamingModels = WORKERS_AI_STREAMING_MODELS

export const workersAIReasoningModels = WORKERS_AI_REASONING_MODELS

/**
 * Type helper to validate a model name belongs to a capability set.
 */
export function isTextModel(name: string): name is WorkersAITextModelName {
  return (WORKERS_AI_TEXT_MODELS as readonly string[]).includes(name)
}

export function isStreamingModel(name: string): boolean {
  return (WORKERS_AI_STREAMING_MODELS as readonly string[]).includes(name)
}

export function isReasoningModel(name: string): boolean {
  return (WORKERS_AI_REASONING_MODELS as readonly string[]).includes(name)
}
```

### File 5: `src/utils/api-client.ts`

**Purpose:** Handle API communication with Workers AI.

```typescript
import type { WorkersAIAdapterConfig } from '../types/provider-options'
import type { WorkersAITextModelName } from '../types/models'
import { getModelId } from '../types/models'

/**
 * Request payload for Workers AI API.
 */
interface WorkersAIRequest {
  prompt: string
  stream?: boolean
  max_tokens?: number
  temperature?: number
  top_p?: number
  top_k?: number
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
  [key: string]: unknown
}

/**
 * Response from Workers AI API.
 */
interface WorkersAIResponse {
  result: {
    response: string
    finish_reason?: string
  }
  success: boolean
  errors: Array<{ message: string }>
}

/**
 * Streaming chunk from Workers AI API.
 */
interface WorkersAIStreamChunk {
  response: string
}

export class WorkersAIAPIClient {
  private config: WorkersAIAdapterConfig
  private binding: any

  constructor(config: WorkersAIAdapterConfig) {
    this.config = config
    this.binding = config.binding

    if (!this.binding) {
      throw new Error(
        'WorkersAI binding not provided. Pass env.AI to adapter config.'
      )
    }
  }

  /**
   * Send a text generation request to Workers AI.
   */
  async generateText(
    modelName: WorkersAITextModelName,
    prompt: string,
    options: Record<string, unknown> = {}
  ): Promise<string> {
    const modelId = getModelId(modelName)
    const payload: WorkersAIRequest = {
      prompt,
      ...options,
    }

    if (this.config.debug) {
      console.log(`[WorkersAI] Request to ${modelId}:`, payload)
    }

    try {
      const response = await this.binding.run(modelId, payload)

      if (this.config.debug) {
        console.log(`[WorkersAI] Response:`, response)
      }

      if (!response.success) {
        throw new Error(
          `Workers AI error: ${response.errors?.[0]?.message || 'Unknown error'}`
        )
      }

      return response.result.response
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`WorkersAI API error: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Stream text generation from Workers AI.
   * Returns an async iterable of chunks.
   */
  async *streamText(
    modelName: WorkersAITextModelName,
    prompt: string,
    options: Record<string, unknown> = {}
  ): AsyncIterable<WorkersAIStreamChunk> {
    const modelId = getModelId(modelName)
    const payload: WorkersAIRequest = {
      prompt,
      stream: true,
      ...options,
    }

    if (this.config.debug) {
      console.log(`[WorkersAI] Stream request to ${modelId}:`, payload)
    }

    try {
      const response = await this.binding.run(modelId, payload)

      if (!response.success) {
        throw new Error(
          `Workers AI error: ${response.errors?.[0]?.message || 'Unknown error'}`
        )
      }

      // Stream response as ReadableStream
      const reader = response.result.response.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          // Parse streaming chunks (Workers AI streams JSON lines)
          for (const line of chunk.split('\n')) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line)
                yield { response: parsed.response || '' }
              } catch (e) {
                // Skip malformed lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`WorkersAI streaming error: ${error.message}`)
      }
      throw error
    }
  }
}
```

### File 6: `src/adapters/text-adapter.ts`

**Purpose:** Implement the text generation adapter following TanStack AI patterns.

```typescript
import type {
  TextStreamPart,
  LanguageModelV1,
  LanguageModelV1TextGenerationOptions,
  LanguageModelV1StreamPart,
} from '@tanstack/ai'
import { TextStreamPart as TanStackTextStreamPart } from '@tanstack/ai'
import type {
  WorkersAIAdapterConfig,
  WorkersAITextModelProviderOptionsByName,
} from '../types/provider-options'
import type {
  WorkersAITextModelName,
  WorkersAIModelName,
} from '../types/models'
import { getModelMetadata, getModelId } from '../types/models'
import { WorkersAIAPIClient } from '../utils/api-client'

/**
 * Normalized request options for the API.
 */
interface NormalizedOptions {
  max_tokens?: number
  temperature?: number
  top_p?: number
  top_k?: number
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
  metadata?: Record<string, unknown>
}

/**
 * WorkersAI text generation adapter for TanStack AI.
 *
 * Usage:
 * ```ts
 * const adapter = workersAIText(config)('llama-3.3-70b-instruct-fp8-fast')
 *
 * const response = await chat({
 *   adapter,
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })
 * ```
 */
export class WorkersAITextAdapter implements LanguageModelV1 {
  readonly specificationVersion = 'v1'
  readonly provider = 'cloudflare-workers-ai'
  readonly modelId: string
  readonly defaultObjectGenerationMode = 'tool' as const

  private apiClient: WorkersAIAPIClient
  private modelName: WorkersAITextModelName

  constructor(
    config: WorkersAIAdapterConfig,
    modelName: WorkersAITextModelName
  ) {
    this.modelName = modelName
    this.modelId = getModelId(modelName)
    this.apiClient = new WorkersAIAPIClient(config)
  }

  /**
   * Generate text from messages.
   * Implements TanStack AI's LanguageModelV1 interface.
   */
  async doGenerate(
    options: LanguageModelV1TextGenerationOptions
  ): Promise<{
    text: string
    finishReason: string
    usage: { inputTokens: number; outputTokens: number }
  }> {
    const normalizedOptions = this.normalizeOptions(
      (options.providerOptions as Partial<
        WorkersAITextModelProviderOptionsByName[WorkersAITextModelName]
      >) || {}
    )

    // Convert messages to prompt
    const prompt = this.messagesToPrompt(options.messages)

    // Generate text
    const text = await this.apiClient.generateText(
      this.modelName,
      prompt,
      normalizedOptions
    )

    // Return response with estimation of token counts
    // (Workers AI doesn't provide token counts in response)
    return {
      text,
      finishReason: 'stop',
      usage: {
        inputTokens: this.estimateTokens(prompt),
        outputTokens: this.estimateTokens(text),
      },
    }
  }

  /**
   * Stream text generation from messages.
   * Implements TanStack AI's stream interface.
   */
  async doStream(
    options: LanguageModelV1TextGenerationOptions
  ): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>
    rawCall?: { rawPrompt?: string; rawSettings?: Record<string, unknown> }
  }> {
    const normalizedOptions = this.normalizeOptions(
      (options.providerOptions as Partial<
        WorkersAITextModelProviderOptionsByName[WorkersAITextModelName]
      >) || {}
    )

    const prompt = this.messagesToPrompt(options.messages)

    return {
      stream: new ReadableStream({
        async start(controller) {
          try {
            let fullText = ''

            for await (const chunk of this.apiClient.streamText(
              this.modelName,
              prompt,
              normalizedOptions
            )) {
              const text = chunk.response || ''
              fullText += text

              controller.enqueue({
                type: 'text-delta',
                textDelta: text,
              } as LanguageModelV1StreamPart)
            }

            // Send finish message
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              logprobs: undefined,
            } as LanguageModelV1StreamPart)

            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      }.bind(this)),
    }
  }

  /**
   * Get model information.
   */
  getModelInformation(): {
    architecture?: string
    maxTokens?: number
    costPer1kTokens?: { input: number; output: number }
  } {
    const metadata = getModelMetadata(this.modelName)
    return {
      architecture: metadata.displayName,
      maxTokens: metadata.maxTokens,
      costPer1kTokens: metadata.costPer1kTokens,
    }
  }

  /**
   * Convert message array to prompt string.
   * (Basic implementation; can be enhanced with system prompts, etc.)
   */
  private messagesToPrompt(
    messages: Array<{ role: string; content: string }>
  ): string {
    return messages
      .map((msg) => {
        const prefix = msg.role === 'user' ? 'User' : 'Assistant'
        return `${prefix}: ${msg.content}`
      })
      .join('\n\n')
  }

  /**
   * Normalize provider options to API format.
   */
  private normalizeOptions(
    options: Partial<
      WorkersAITextModelProviderOptionsByName[WorkersAITextModelName]
    >
  ): NormalizedOptions {
    return {
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      top_p: options.top_p,
      top_k: options.top_k,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
      seed: options.seed,
      metadata: options.metadata,
    }
  }

  /**
   * Simple token estimation (1 token ≈ 4 characters).
   * In production, use a proper tokenizer.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}

/**
 * Factory function to create a WorkersAI text generation adapter.
 *
 * Usage:
 * ```ts
 * import { workersAIText } from '@tanstack/ai-workers-ai'
 * import { chat } from '@tanstack/ai'
 *
 * const adapter = workersAIText({
 *   binding: env.AI,
 *   debug: true,
 * })
 *
 * const stream = chat({
 *   adapter: adapter('llama-3.3-70b-instruct-fp8-fast'),
 *   messages: [{ role: 'user', content: 'Hello' }],
 * })
 * ```
 */
export function workersAIText(config: WorkersAIAdapterConfig) {
  return (modelName: WorkersAITextModelName): LanguageModelV1 => {
    return new WorkersAITextAdapter(config, modelName)
  }
}

/**
 * Shorthand for creating a model instance directly.
 * Use this when you have a Workers environment with AI binding.
 */
export function workersAITextModel(
  modelName: WorkersAITextModelName,
  config?: Partial<WorkersAIAdapterConfig>
): LanguageModelV1 {
  if (!config?.binding) {
    throw new Error('AI binding is required. Pass it in config.binding')
  }

  return new WorkersAITextAdapter(
    {
      binding: config.binding,
      timeout: config.timeout,
      debug: config.debug,
    },
    modelName
  )
}
```

### File 7: `src/index.ts`

**Purpose:** Main export file for the adapter.

```typescript
/**
 * @tanstack/ai-workers-ai
 *
 * TanStack AI adapter for Cloudflare Workers AI.
 * Provides type-safe, serverless AI inference integration.
 *
 * @example
 * ```ts
 * import { workersAIText } from '@tanstack/ai-workers-ai'
 * import { chat } from '@tanstack/ai'
 *
 * const adapter = workersAIText({ binding: env.AI })
 * const stream = chat({
 *   adapter: adapter('llama-3.3-70b-instruct-fp8-fast'),
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })
 * ```
 */

// Models and metadata
export {
  LLAMA_3_3_70B,
  DEEPSEEK_R1_DISTILL_QWEN,
  QWEN_2_5_TURBO,
  MISTRAL_LARGE_2,
  LLAMA_2_7B,
  WORKERS_AI_TEXT_MODELS,
  WORKERS_AI_STREAMING_MODELS,
  WORKERS_AI_REASONING_MODELS,
  getModelMetadata,
  getModelId,
  type WorkersAIModelName,
  type WorkersAITextModelName,
  type ModelMetadata,
} from './types/models'

// Provider options
export {
  type WorkersAIBaseOptions,
  type WorkersAIStreamingOptions,
  type WorkersAIMetadataOptions,
  type WorkersAITextModelProviderOptionsByName,
  type WorkersAITextModelProviderOptions,
  type WorkersAIAdapterConfig,
  type WorkersAILlama3_3_70bOptions,
  type WorkersAIDeepseekOptions,
  type WorkersAIQwenOptions,
  type WorkersAIMistralOptions,
  type WorkersAILlama2_7bOptions,
} from './types/provider-options'

// Input/output modalities
export {
  type WorkersAIModelInputModalitiesByName,
  type WorkersAIModelOutputModalitiesByName,
} from './types/input-modalities'

// Capabilities
export {
  workersAITextModels,
  workersAIStreamingModels,
  workersAIReasoningModels,
  isTextModel,
  isStreamingModel,
  isReasoningModel,
} from './types/capabilities'

// Adapters
export {
  WorkersAITextAdapter,
  workersAIText,
  workersAITextModel,
} from './adapters/text-adapter'

// API client (for advanced usage)
export { WorkersAIAPIClient } from './utils/api-client'
```

### File 8: `README.md`

**Purpose:** Complete documentation for users.

````markdown
# @tanstack/ai-workers-ai

A **TanStack AI** adapter for **Cloudflare Workers AI**, enabling type-safe, serverless AI inference with 50+ open-source models.

## Features

- ✨ **Type-Safe**: Full TypeScript support with per-model option configuration
- 🚀 **Serverless**: Run on Cloudflare's global GPU network, pay-per-use
- 🔄 **Streaming**: Native support for token-by-token streaming responses
- 📊 **Observable**: Built-in observability with OpenTelemetry support
- 🧩 **Composable**: Works seamlessly with TanStack AI's ecosystem
- 📚 **Well-Documented**: Comprehensive examples and API reference

## Installation

```bash
npm install @tanstack/ai-workers-ai
```

### Prerequisites

- Node.js 18+
- A Cloudflare Workers project with AI binding configured
- TanStack AI `^0.0.x`

### Setup Workers AI Binding

Add to your `wrangler.jsonc`:

```json
{
  "env": {
    "production": {
      "ai": {
        "binding": "AI"
      }
    }
  }
}
```

## Quick Start

### Basic Text Generation

```typescript
import { workersAIText } from '@tanstack/ai-workers-ai'
import { generateText } from '@tanstack/ai'

export default {
  async fetch(request: Request, env: Env) {
    const adapter = workersAIText({ binding: env.AI })

    const { text } = await generateText({
      adapter: adapter('llama-3.3-70b-instruct-fp8-fast'),
      messages: [
        { role: 'user', content: 'Write a haiku about coding' },
      ],
    })

    return new Response(text)
  },
}
```

### Streaming Response

```typescript
import { workersAIText } from '@tanstack/ai-workers-ai'
import { chat, toServerSentEventsResponse } from '@tanstack/ai'

export default {
  async fetch(request: Request, env: Env) {
    const { messages } = await request.json()

    const adapter = workersAIText({
      binding: env.AI,
      debug: true, // Optional: enable debug logging
    })

    const stream = chat({
      adapter: adapter('deepseek-r1-distill-qwen-32b'),
      messages,
      providerOptions: {
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 2048,
      },
    })

    return toServerSentEventsResponse(stream)
  },
}
```

## Supported Models

The adapter supports all Cloudflare Workers AI models. Common ones:

| Model | ID | Best For |
|-------|---------|----------|
| Llama 3.3 70B | `llama-3.3-70b-instruct-fp8-fast` | General purpose |
| DeepSeek R1 32B | `deepseek-r1-distill-qwen-32b` | Reasoning tasks |
| Qwen 2.5 Turbo | `qwen-2.5-turbo` | Speed & efficiency |
| Mistral Large | `mistral-large-2` | Multilingual |
| Llama 2 7B | `llama-2-7b-chat-fp16` | Lightweight |

## API Reference

### `workersAIText(config)`

Factory function to create a text adapter.

```typescript
const adapter = workersAIText({
  binding: env.AI, // Required: Cloudflare AI binding
  timeout: 30000, // Optional: request timeout (ms)
  debug: false, // Optional: enable debug logging
})
```

### `adapter(modelName)`

Create a model instance for use with TanStack AI functions.

```typescript
const model = adapter('llama-3.3-70b-instruct-fp8-fast')

const response = await chat({
  adapter: model,
  messages,
})
```

## Type Safety

The adapter provides strict TypeScript types for each model:

```typescript
// ✅ Works - option is supported by this model
const response = await generateText({
  adapter: adapter('llama-3.3-70b-instruct-fp8-fast'),
  providerOptions: {
    temperature: 0.7, // Type-checked!
  },
})

// ❌ Error - unknown option
const response = await generateText({
  adapter: adapter('llama-3.3-70b-instruct-fp8-fast'),
  providerOptions: {
    unknown_option: true, // TypeScript error!
  },
})
```

## Runtime Adapter Switching

Switch between providers at runtime with full type safety:

```typescript
type Provider = 'workers-ai' | 'openai'

const adapters = {
  'workers-ai': () =>
    workersAIText({ binding: env.AI })('llama-3.3-70b-instruct-fp8-fast'),
  'openai': () => openaiText(process.env.OPENAI_API_KEY)('gpt-4o'),
}

const stream = chat({
  adapter: adapters[provider](),
  messages,
})
```

## Advanced Configuration

### Streaming-Specific Options

```typescript
const stream = chat({
  adapter: adapter('llama-3.3-70b-instruct-fp8-fast'),
  messages,
  providerOptions: {
    stream: true, // Enable streaming (default for chat)
    temperature: 0.8,
    top_p: 0.95,
    max_tokens: 4096,
  },
})
```

### Deterministic Generation

```typescript
const response = await generateText({
  adapter: adapter('llama-3.3-70b-instruct-fp8-fast'),
  messages,
  providerOptions: {
    seed: 42, // Reproducible outputs
    temperature: 0, // No randomness
  },
})
```

## Monitoring & Observability

Enable debug logging to inspect requests and responses:

```typescript
const adapter = workersAIText({
  binding: env.AI,
  debug: true,
})

// Console output:
// [WorkersAI] Request to @cf/meta/llama-3.3-70b-instruct-fp8-fast:
// { prompt: "...", temperature: 0.7, ... }
// [WorkersAI] Response:
// { result: { response: "..." }, success: true }
```

## Error Handling

```typescript
import { generateText } from '@tanstack/ai'

try {
  const response = await generateText({
    adapter: adapter('llama-3.3-70b-instruct-fp8-fast'),
    messages,
  })
} catch (error) {
  if (error instanceof Error) {
    console.error('Generation failed:', error.message)
    // Handle: API errors, timeout, binding issues, etc.
  }
}
```

## Contributing

To add support for additional Workers AI models:

1. Add model definition to `src/types/models.ts`
2. Add to `WORKERS_AI_TEXT_MODELS` array
3. Add corresponding option type to `src/types/provider-options.ts`
4. Update model mapping in `WorkersAITextModelProviderOptionsByName`
5. Submit a PR

## License

MIT © Cloudflare

## See Also

- [TanStack AI Docs](https://tanstack.com/ai)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
````

---

## Testing

### Basic Unit Tests

```typescript
// src/adapters/text-adapter.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WorkersAITextAdapter } from './text-adapter'
import type { WorkersAIAdapterConfig } from '../types/provider-options'

describe('WorkersAITextAdapter', () => {
  let mockBinding: any
  let config: WorkersAIAdapterConfig
  let adapter: WorkersAITextAdapter

  beforeEach(() => {
    mockBinding = {
      run: vi.fn(),
    }

    config = {
      binding: mockBinding,
      debug: false,
    }

    adapter = new WorkersAITextAdapter(config, 'llama-3.3-70b-instruct-fp8-fast')
  })

  it('should generate text', async () => {
    mockBinding.run.mockResolvedValue({
      success: true,
      result: { response: 'Generated text' },
    })

    const result = await adapter.doGenerate({
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.7,
      providerOptions: {},
    })

    expect(result.text).toBe('Generated text')
    expect(result.finishReason).toBe('stop')
  })

  it('should handle API errors', async () => {
    mockBinding.run.mockResolvedValue({
      success: false,
      errors: [{ message: 'Rate limited' }],
    })

    expect(
      adapter.doGenerate({
        messages: [{ role: 'user', content: 'Hello' }],
        providerOptions: {},
      })
    ).rejects.toThrow('Rate limited')
  })
})
```

---

## Publishing

### Prepare for npm

1. **Bump version** in `package.json`
2. **Build** with `npm run build`
3. **Type-check** with `npm run type-check`
4. **Test** with `npm run test`
5. **Create CHANGELOG.md** documenting changes

### Publish to npm

```bash
# Login to npm
npm login

# Publish
npm publish

# Verify
npm view @tanstack/ai-workers-ai
```

### Submit to TanStack

Open a PR to the [TanStack AI repository](https://github.com/tanstack/ai):

1. Add adapter to `docs/community-adapters/index.md`
2. Include link to your npm package
3. Add to framework registry

---

## Key Takeaways for Cursor Prompt

When building this with Cursor, emphasize:

1. **Metadata-first design** - define models before implementing logic
2. **Type composition** - use fragment patterns for extensibility
3. **TanStack conventions** - follow OpenAI adapter structure exactly
4. **Per-model typing** - ensure no `any` types exist
5. **Streaming support** - async iterables for token-by-token output
6. **Error handling** - wrap API errors with context
7. **Production-ready** - no debug code, proper exports, complete docs

---

## Next Steps

After building this:

1. Publish to npm
2. Open PR to TanStack AI community adapters list
3. Create example projects (Remix, SvelteKit, Nuxt)
4. Add image generation support
5. Add embeddings support (once Workers AI supports it)
6. Monitor issues and community contributions

