// lib/ai/model.ts
//
// Single source of truth for which Claude model the app talks to.
//
// Why this helper exists:
// We support two providers — Anthropic direct (api.anthropic.com) and
// OpenRouter (gateway). Switching is a single env var flip, no code changes:
//
//   AI_PROVIDER=anthropic   → uses ANTHROPIC_API_KEY  (direct, lower cost)
//   AI_PROVIDER=openrouter  → uses OPENROUTER_API_KEY (gateway, ~5% markup,
//                                                     useful as billing fallback)
//
// Default is `openrouter`. Set AI_PROVIDER=anthropic in .env.local to switch back.

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText } from 'ai'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import type { z } from 'zod'
import { env } from '@/lib/env'

type ProviderName = 'anthropic' | 'openrouter'

const ANTHROPIC_MODEL_ID = 'claude-sonnet-4-6'
// OpenRouter model IDs are namespaced — the Anthropic Sonnet 4.6 entry is
// published as `anthropic/claude-sonnet-4.6`. Verified against
// https://openrouter.ai/models?supported_parameters=structured_outputs
const OPENROUTER_MODEL_ID = 'anthropic/claude-sonnet-4.6'

/**
 * Returns the LanguageModelV1 instance for the active AI provider.
 * Used by streamText, generateObject, and generateText callsites.
 *
 * Throws if the required API key for the active provider is missing —
 * fail loudly here rather than producing empty/weird responses downstream.
 */
export function getAIModel(): LanguageModelV1 {
  if (env.aiProvider === 'anthropic') {
    if (!env.anthropicApiKey) {
      throw new Error(
        '[ai/model] AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.',
      )
    }
    return createAnthropic({ apiKey: env.anthropicApiKey })(ANTHROPIC_MODEL_ID)
  }

  // openrouter
  if (!env.openrouterApiKey) {
    throw new Error(
      '[ai/model] AI_PROVIDER=openrouter but OPENROUTER_API_KEY is not set.',
    )
  }
  return createOpenRouter({ apiKey: env.openrouterApiKey })(OPENROUTER_MODEL_ID)
}

/** Exposed for diagnostics / logging. */
export function getActiveProvider(): ProviderName {
  return env.aiProvider
}

// ---------------------------------------------------------------------------
// generateJSON — drop-in replacement for `ai.generateObject` that works
// reliably across providers (Anthropic direct + OpenRouter).
//
// Why we don't just use generateObject:
// `generateObject` defaults to mode='tool' for Anthropic, which uses
// Anthropic's native tool-use API. When routed through OpenRouter, the
// tool-use translation drops fields (we observed empty `{}` outputs even
// when the model spent ~1700 completion tokens). Switching to mode='json'
// fixes that but Sonnet 4.6 happily wraps its JSON in ```json``` fences,
// renames schema keys, and otherwise plays loose with the format.
//
// generateJSON solves both problems with a small, explicit recipe:
//   1. Build a system prompt that bakes in the schema hint AND a hard rule
//      "no code fences, exact key names".
//   2. Call streamText (no provider-specific tool format).
//   3. Strip ```json``` fences if the model included them.
//   4. JSON.parse, then validate with Zod.
//
// schemaHint is a human-written description of the JSON shape the model
// should produce (e.g. `{ "title": string, "items": [{ ... }] }`). Pass
// the same shape your Zod schema validates — the hint guides the model,
// the schema enforces it.
// ---------------------------------------------------------------------------

const FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i

export async function generateJSON<T>(opts: {
  schema: z.ZodType<T>
  schemaHint: string
  system: string
  prompt: string
  maxTokens: number
  /**
   * Optional file attachments rendered as FileParts alongside the prompt
   * text. Used for PDF lab submissions; the model reads them natively
   * (no extraction library needed).
   */
  attachments?: Array<{
    mimeType: string
    data: Uint8Array | ArrayBuffer | string
    filename?: string
  }>
}): Promise<T> {
  const fullSystem = `${opts.system}

OUTPUT FORMAT — CRITICAL:
- Respond with ONE JSON object matching the schema below.
- DO NOT wrap the JSON in markdown code fences. NO triple backticks.
- DO NOT include any prose, comments, or explanation before or after the JSON.
- Use the EXACT field names from the schema — do not rename or paraphrase keys.

SCHEMA:
${opts.schemaHint}`

  const hasAttachments = !!opts.attachments && opts.attachments.length > 0
  const result = hasAttachments
    ? await streamText({
        model: getAIModel(),
        maxTokens: opts.maxTokens,
        system: fullSystem,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: opts.prompt },
              ...opts.attachments!.map((a) => ({
                type: 'file' as const,
                data: a.data,
                mimeType: a.mimeType,
                filename: a.filename,
              })),
            ],
          },
        ],
      })
    : await streamText({
        model: getAIModel(),
        maxTokens: opts.maxTokens,
        system: fullSystem,
        prompt: opts.prompt,
      })

  let text = ''
  for await (const delta of result.textStream) {
    text += delta
  }

  const fenceMatch = text.trim().match(FENCE_RE)
  const cleaned = (fenceMatch ? fenceMatch[1] : text).trim()

  let raw: unknown
  try {
    raw = JSON.parse(cleaned)
  } catch (err) {
    const preview = cleaned.slice(0, 300)
    throw new Error(
      `AI returned non-JSON output. First 300 chars: ${preview}${cleaned.length > 300 ? '…' : ''}`,
      { cause: err },
    )
  }

  const validated = opts.schema.safeParse(raw)
  if (!validated.success) {
    throw new Error(
      `AI output did not match schema: ${validated.error.message}. Raw: ${JSON.stringify(raw).slice(0, 400)}`,
    )
  }
  return validated.data
}
