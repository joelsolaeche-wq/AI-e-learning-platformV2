# Synapse Redesign — Codebase Port

Drop-in Next.js / Tailwind / shadcn files for `joelsolaeche-wq/AI-e-learning-platformV2`.

## What's here

```
codebase-port/
├── app/
│   ├── globals.css                 # Token swap (dark, violet+cyan)
│   ├── dashboard/
│   │   ├── layout.tsx              # Sidebar + TopBar + global TutorPanel
│   │   └── page.tsx                # Hero + cohort grid w/ progress rings
│   └── catalog/
│       └── page.tsx                # Gradient course cards
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # 248px sidebar w/ active glow + streak + user
│   │   └── TopBar.tsx              # Search + XP/Lvl chip + notif bell
│   ├── ui/
│   │   └── Ring.tsx                # SVG progress ring, glow shadow
│   ├── QuizSection.tsx             # Card-stack quiz, animated reveal
│   └── TutorPanel.tsx              # Floating AI dock (⌘J)
└── README.md (this file)
```

## How to integrate

1. **Replace `app/globals.css`** with `codebase-port/app/globals.css`.
   - Adds Inter + JetBrains Mono fonts, ambient gradient bg, dark tokens.
   - Force `<html className="dark">` in `app/layout.tsx`.
2. **Drop `components/layout/Sidebar.tsx` + `TopBar.tsx`** into `components/layout/`.
3. **Replace `app/dashboard/layout.tsx`** with the version here. It pulls the user/profile and renders the chrome + global `TutorPanel`.
4. **Replace `app/dashboard/page.tsx`** — keeps your existing Supabase queries, only the markup changes. Types use your `Database` from `@/lib/database.types`.
5. **Replace `app/catalog/page.tsx`** — same data shape, gradient cards instead of plain ones.
6. **Drop `components/QuizSection.tsx`** — card-stack version. Same prop shape: `{ questions, lessonId, onComplete }`.
7. **Drop `components/TutorPanel.tsx`** — calls `POST /api/chat` with `{ messages, lessonId }`. Wire it to your existing route.

## Notes & caveats

- **Lesson page (`/dashboard/lesson/[lessonId]`)** is not in this batch — its split into a server component (data fetch) + a client `<LessonExperience>` (Mux player + tabs). Once you confirm the seven files above land cleanly, I'll write that next.
- **Achievements / Leaderboard / Team** — placeholder routes referenced in the sidebar. Add empty pages or remove from `NAV` until ready.
- **Tailwind v4** assumed (your repo uses `@import "tailwindcss"`). If you're on v3, change the imports at the top of `globals.css` to `@tailwind base; @tailwind components; @tailwind utilities;` and move tokens into `tailwind.config.ts` instead of `@theme inline`.
- **shadcn** — these files don't introduce new shadcn primitives; they style with raw Tailwind so they slot in without registry installs.
- **Icons** — `lucide-react` only (already in your deps).

## Color tokens (for reference)

| Token | Value | Use |
|---|---|---|
| `--background` | `#0B0B14` | Page bg |
| `--card` | `#11111C` | Cards, surfaces |
| `--primary` | violet `#A78BFA` | CTAs, active states, AI |
| `--accent` | cyan `#22D3EE` | Secondary accent, gradient end |
| `--border` | `rgba(255,255,255,0.08)` | Hairlines |

The HTML prototype in this project uses these exact tokens, so you can A/B against the live preview.
