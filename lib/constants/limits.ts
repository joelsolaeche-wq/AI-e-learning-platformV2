// Centralized numeric limits. Group by concern, not by callsite. Each
// value here previously lived inline as a magic number (or worse, was
// declared in both a client component and its companion server route
// with the same name and value — a refactor land-mine).

// ──────────────────────────────────────────────────────────────────────
// Form validation
// ──────────────────────────────────────────────────────────────────────

export const PASSWORD_MIN_CHARS = 8
export const NAME_MAX_CHARS = 100

// ──────────────────────────────────────────────────────────────────────
// AI tutor (/api/tutor/chat) — Synapse Q&A on a lesson
// ──────────────────────────────────────────────────────────────────────

/** Max chars of user message. T-6-03: prevent oversized prompt-injection payloads. */
export const AI_TUTOR_MESSAGE_MAX_CHARS = 2000

/** How many prior turns to load into the model context. */
export const AI_TUTOR_HISTORY_MESSAGES = 20

/**
 * Cap on streamed output tokens. Keep low enough that OpenRouter's pre-flight
 * credit check doesn't reject a request when the account balance is low.
 */
export const AI_TUTOR_MAX_OUTPUT_TOKENS = 1500

/**
 * Max chars of timestamped transcript injected into the system prompt.
 * ~120k chars ≈ 30k tokens, comfortably below context budget while leaving
 * headroom for scaffolding + prior messages + answer.
 */
export const AI_TUTOR_TRANSCRIPT_PROMPT_MAX_CHARS = 120_000

// ──────────────────────────────────────────────────────────────────────
// AI lab draft (/api/admin/labs/draft) — admin generates a lab from a lesson
// ──────────────────────────────────────────────────────────────────────

/** Slice of transcript fed to the drafting model (~6k tokens). */
export const AI_LAB_DRAFT_TRANSCRIPT_MAX_CHARS = 24_000

export const AI_LAB_DRAFT_MAX_OUTPUT_TOKENS = 6000

// ──────────────────────────────────────────────────────────────────────
// AI lab evaluator (lib/labs/evaluate.ts) — grades a submission
// ──────────────────────────────────────────────────────────────────────

/** Smaller transcript slice; the grading prompt is dominated by the repo snapshot. */
export const AI_LAB_EVAL_TRANSCRIPT_MAX_CHARS = 12_000

/** Max chars of fetched repo content fed into the grading prompt. */
export const AI_LAB_EVAL_REPO_BUDGET_CHARS = 120_000

export const AI_LAB_EVAL_MAX_OUTPUT_TOKENS = 8000

/** Ceiling on the model call. Match `export const maxDuration = 90` on the route. */
export const AI_LAB_EVAL_TIMEOUT_MS = 90_000

// ──────────────────────────────────────────────────────────────────────
// Lab submission payloads
// ──────────────────────────────────────────────────────────────────────

export const LAB_TEXT_MIN_CHARS = 200
export const LAB_TEXT_MAX_CHARS = 30_000

export const LAB_PDF_MAX_BYTES = 25 * 1024 * 1024

// ──────────────────────────────────────────────────────────────────────
// Transcript ingestion (admin paste)
// ──────────────────────────────────────────────────────────────────────

export const TRANSCRIPT_RAW_MAX_CHARS = 500_000

// ──────────────────────────────────────────────────────────────────────
// DB query limits
// ──────────────────────────────────────────────────────────────────────

export const ADMIN_USER_SEARCH_LIMIT = 10
