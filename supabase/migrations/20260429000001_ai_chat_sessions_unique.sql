-- Add unique constraint to prevent duplicate (user_id, lesson_id) sessions.
-- Without this, a race condition in the SELECT-then-INSERT pattern can create
-- duplicate rows, causing .maybeSingle() to throw PGRST116 on subsequent requests.
alter table public.ai_chat_sessions
  add constraint ai_chat_sessions_user_lesson_unique
  unique (user_id, lesson_id);
