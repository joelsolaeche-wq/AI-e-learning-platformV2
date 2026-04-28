-- ============================================================
-- Seed: Demo Data for AI Platform v2
-- Run separately after migrations: npx supabase db reset
-- or via Supabase dashboard SQL editor for cloud.
-- NOTE: Does NOT seed auth.users or tables that require
-- a real user_id (enrollments, lesson_progress, quiz_attempts,
-- ai_chat_sessions, ai_chat_messages). Those rows are created
-- through app interactions.
-- ============================================================

-- Use fixed UUIDs so seed is idempotent (safe to re-run).

-- ============================================================
-- Organization
-- ============================================================
insert into public.organizations (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000001',
  'Taller Technologies',
  'taller-technologies'
)
on conflict (id) do nothing;

-- ============================================================
-- Course: Generative AI Fundamentals
-- ============================================================
insert into public.courses (id, org_id, title, slug, description, thumbnail_url, is_published)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Generative AI Fundamentals',
  'generative-ai-fundamentals',
  'A hands-on introduction to Generative AI, Large Language Models, and prompt engineering — built for enterprise teams ready to put AI to work.',
  'https://picsum.photos/seed/genai-course/800/450',
  true
)
on conflict (id) do nothing;

-- ============================================================
-- Modules (3)
-- ============================================================
insert into public.modules (id, course_id, title, position)
values
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000010',
    'Introduction to Generative AI',
    1
  ),
  (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000010',
    'Prompt Engineering',
    2
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000010',
    'Building with LLMs',
    3
  )
on conflict (id) do nothing;

-- ============================================================
-- Lessons (3 — one per module)
-- ============================================================
insert into public.lessons (id, module_id, title, position, video_url, mux_playback_id, transcript, duration_seconds)
values
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000020',
    'What is Generative AI?',
    1,
    'https://stream.mux.com/PLACEHOLDER_PLAYBACK_ID_1.m3u8',
    'PLACEHOLDER_PLAYBACK_ID_1',
    'In this lesson, we explore what generative AI is, how it differs from traditional machine learning, and why it matters for enterprise teams. We cover the fundamentals of large language models, their training process, and the key concepts of tokens, context windows, and inference.',
    600
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000021',
    'Writing Effective Prompts',
    1,
    'https://stream.mux.com/PLACEHOLDER_PLAYBACK_ID_2.m3u8',
    'PLACEHOLDER_PLAYBACK_ID_2',
    'This lesson covers prompt engineering fundamentals: zero-shot vs few-shot prompting, chain-of-thought reasoning, role prompting, and structured output techniques. We walk through real examples of prompts that get reliable results from Claude and GPT-4.',
    720
  ),
  (
    '00000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000022',
    'Your First LLM-Powered Feature',
    1,
    'https://stream.mux.com/PLACEHOLDER_PLAYBACK_ID_3.m3u8',
    'PLACEHOLDER_PLAYBACK_ID_3',
    'We build a simple AI-powered feature end to end: calling the Anthropic API, handling streaming responses, managing context windows, and avoiding common pitfalls like prompt injection. By the end you will have a working AI integration pattern you can apply to your own projects.',
    840
  )
on conflict (id) do nothing;

-- ============================================================
-- Quiz Definition (for lesson 1 only — sufficient for demo)
-- ============================================================
insert into public.quiz_definitions (id, lesson_id, questions)
values (
  '00000000-0000-0000-0000-000000000040',
  '00000000-0000-0000-0000-000000000030',
  '[
    {
      "id": "q1",
      "question": "What is a token in the context of a large language model?",
      "options": [
        "A full sentence processed by the model",
        "A unit of text (word or word fragment) that the model processes",
        "A security credential used to authenticate API requests",
        "A single character in the input string"
      ],
      "correct_answer": "A unit of text (word or word fragment) that the model processes",
      "explanation": "Tokens are the basic units of text that LLMs process. A token is typically a word or a common sub-word fragment — for example, tokenization might be split into token and ization. Most English words are 1-2 tokens."
    },
    {
      "id": "q2",
      "question": "What does the context window of an LLM determine?",
      "options": [
        "The maximum number of users who can query the model simultaneously",
        "The total number of tokens the model can process in a single interaction",
        "The number of training examples used to fine-tune the model",
        "The latency of the API response in milliseconds"
      ],
      "correct_answer": "The total number of tokens the model can process in a single interaction",
      "explanation": "The context window defines how much text (measured in tokens) an LLM can see at once — both the input prompt and the output response must fit within this window. A larger context window allows longer conversations and bigger documents."
    },
    {
      "id": "q3",
      "question": "Which of the following best describes how a generative AI model produces output?",
      "options": [
        "It retrieves a pre-written answer from a database",
        "It executes a deterministic rule-based algorithm",
        "It predicts the next most likely token given all preceding tokens",
        "It runs a search query against the training dataset"
      ],
      "correct_answer": "It predicts the next most likely token given all preceding tokens",
      "explanation": "Generative AI models work by predicting the next token in a sequence, one token at a time. This process is called autoregressive generation. The model does not look up answers — it generates them token by token based on learned probability distributions."
    }
  ]'::jsonb
)
on conflict (id) do nothing;

-- ============================================================
-- Cohort (1 active cohort for the demo course)
-- ============================================================
insert into public.cohorts (id, course_id, title, starts_at, ends_at, max_seats, status)
values (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000010',
  'May 2026 Cohort',
  '2026-05-01T09:00:00Z',
  '2026-05-29T17:00:00Z',
  20,
  'active'
)
on conflict (id) do nothing;

-- ============================================================
-- Phase 3: Teammate seed data
-- 2 fake teammate accounts so the learner dashboard cohort roster
-- is non-empty on first run. auth.users stub rows are inserted
-- first because public.profiles.id has a FK to auth.users.id.
-- ============================================================

-- ------------------------------------------------------------
-- auth.users stub rows (REQUIRED before profiles insert)
-- ------------------------------------------------------------
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000061',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'jane.doe@tallertechnologies.net',
    '',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Jane Doe"}'::jsonb,
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000062',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alex.kim@tallertechnologies.net',
    '',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Alex Kim"}'::jsonb,
    false,
    false
  )
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- public.profiles for the two teammates
-- ------------------------------------------------------------
insert into public.profiles (id, email, full_name, role, org_id)
values
  (
    '00000000-0000-0000-0000-000000000061',
    'jane.doe@tallertechnologies.net',
    'Jane Doe',
    'learner',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000062',
    'alex.kim@tallertechnologies.net',
    'Alex Kim',
    'learner',
    '00000000-0000-0000-0000-000000000001'
  )
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- public.enrollments for both teammates in the May 2026 Cohort
-- ------------------------------------------------------------
insert into public.enrollments (id, user_id, cohort_id, status)
values
  (
    '00000000-0000-0000-0000-000000000071',
    '00000000-0000-0000-0000-000000000061',
    '00000000-0000-0000-0000-000000000050',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000072',
    '00000000-0000-0000-0000-000000000062',
    '00000000-0000-0000-0000-000000000050',
    'active'
  )
on conflict (id) do nothing;
