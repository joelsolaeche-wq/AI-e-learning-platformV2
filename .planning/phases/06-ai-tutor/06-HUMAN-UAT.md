---
status: partial
phase: 06-ai-tutor
source: [06-VERIFICATION.md]
started: 2026-04-29T00:00:00Z
updated: 2026-04-29T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Streaming latency — first tokens within 2 seconds
expected: After typing a message and clicking Send, the AI response begins streaming (first tokens visible) within 2 seconds — no blank waiting period followed by a full batch response
result: [pending]

### 2. Transcript grounding quality
expected: When asked a question referencing lesson content (e.g., "What did the instructor mean by token context window?"), the AI tutor cites or paraphrases specific content from the lesson transcript — not just generic LLM knowledge
result: [pending]

### 3. Out-of-scope refusal
expected: When asked "What's the weather in Paris?" or "Write me a poem", the tutor responds with a polite refusal redirecting to course topics — no off-topic answer is returned
result: [pending]

### 4. History persistence across page reload
expected: After a conversation, closing and reopening the lesson page shows the full prior conversation in the chat panel in correct chronological order
result: [pending]

### 5. Race condition safety (single-user demo flow)
expected: Normal single-user flow (one tab, sequential messages) creates exactly one ai_chat_sessions row and chat works correctly across all requests with no HTTP 500 errors
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
