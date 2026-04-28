# Stack Research
> AI-native e-learning platform — Enterprise cohort model
> Base stack: Next.js 15 (App Router) + Supabase + Claude API
> Last updated: 2025-04-28

---

## Core Stack (Decided)

### Next.js 15 — App Router
The App Router model (React Server Components + Server Actions) is the right foundation for this project. RSCs let you fetch cohort/lesson data directly in layout and page components without a client-side loading state, keeping the initial render fast and SEO-friendly for marketing pages. Server Actions eliminate the need for hand-rolled API routes for mutations (enrollment, quiz submission). The streaming model in Next.js 15 pairs naturally with Claude's streaming API — you can pipe a `ReadableStream` directly from a Route Handler to the client.

Use `next@15.x` (current stable). Do not pin to Next 14 — the App Router stabilized significantly across 15.x and the caching model is cleaner.

### Supabase
Covers auth, Postgres database, file storage (video uploads if self-hosting clips), and real-time subscriptions (cohort progress updates). The `@supabase/ssr` package (`^0.5.x`) is the correct integration path for Next.js App Router — it handles cookie-based session management in both Server Components and Route Handlers. Do not use the older `@supabase/auth-helpers-nextjs` package; it is deprecated.

Key Supabase features to use:
- **Row Level Security (RLS)**: Enforce cohort membership at the DB layer so no server-side guard logic is needed in every route.
- **Realtime**: Subscribe to `cohort_progress` table changes to show live cohort completion stats without polling.
- **Storage**: Can host short demo videos (< 500 MB). For production-grade video, see Video section below.

---

## Video & Media

### Recommended: Mux + `@mux/mux-player-react`
**Package:** `@mux/mux-player-react@^2.x`
**Hosting:** Mux Video (SaaS, per-minute pricing)
**Confidence: High**

Mux is the industry standard for developer-first video infrastructure in 2025. It is what Linear, Vercel, and most high-production SaaS products use.

**Why Mux:**
- Upload once via the Mux API, get an adaptive bitrate HLS stream automatically. No FFmpeg pipeline to maintain.
- `<MuxPlayer>` is a drop-in Web Component wrapper with a clean headless API, fully styleable with CSS custom properties. Dark theme is trivial.
- Built-in analytics: per-viewer playback quality, buffer events, completion rates — critical for an e-learning product.
- Signed URLs out of the box: restrict video playback to authenticated cohort members using JWT tokens generated server-side.
- Demo-tier free: 500 minutes stored / 500 minutes delivered free per month — enough for a demo.

**Integration pattern:**
```ts
// app/lessons/[id]/page.tsx (Server Component)
import MuxPlayer from "@mux/mux-player-react";

// Generate a short-lived signed playback token server-side
const token = await getMuxSignedToken(lesson.mux_playback_id);

return <MuxPlayer playbackId={lesson.mux_playback_id} tokens={{ playback: token }} />;
```

**Why NOT Cloudflare Stream:** Cloudflare Stream is a solid alternative and cheaper at scale, but its React player (`cloudflare-stream-react`) is less maintained, the analytics are weaker, and the DX is noticeably rougher. Use it only if you are already on Cloudflare's infrastructure.

**Why NOT Vimeo/YouTube embeds:** Zero control over the player UI, branding watermarks, and no signed URL access control. Not acceptable for a premium enterprise product.

**Why NOT storing video in Supabase Storage:** Supabase Storage is object storage (S3-compatible), not a video CDN. You'd get no adaptive bitrate, no edge delivery optimization, and no player. Fine for PDFs and thumbnails, not for video.

---

## AI Integration Layer

### Recommended: Vercel AI SDK + Anthropic Provider
**Packages:**
- `ai@^4.x` (Vercel AI SDK core)
- `@ai-sdk/anthropic@^1.x` (Anthropic provider for the AI SDK)

**Confidence: High**

The Vercel AI SDK is the correct abstraction layer for Next.js + Claude. It handles streaming, token counting, tool calls, and the React hooks layer in a single coherent package. Writing raw fetch calls to the Anthropic API is unnecessary complexity.

**Core pattern — Route Handler (server):**
```ts
// app/api/tutor/route.ts
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export async function POST(req: Request) {
  const { messages, lessonContext } = await req.json();

  const result = await streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: `You are an expert tutor for the lesson: "${lessonContext.title}".
Transcript excerpt: ${lessonContext.transcript}
Answer questions about this specific lesson content only. Be concise.`,
    messages,
    maxTokens: 1024,
  });

  return result.toDataStreamResponse();
}
```

**Core pattern — Client Component (React):**
```tsx
// components/TutorChat.tsx
"use client";
import { useChat } from "ai/react";

export function TutorChat({ lessonContext }: { lessonContext: LessonContext }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/tutor",
    body: { lessonContext }, // injected into every request
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id} data-role={m.role}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

**Session / context management:**
- Persist chat history in Supabase (`tutor_sessions` table, keyed on `user_id + lesson_id`). Load last N messages from DB and pass as initial `messages` to `useChat`.
- Inject lesson context (title, transcript excerpt, quiz topics) as a system prompt on the server — never trust the client to send this. Validate the user's cohort membership in the Route Handler before calling Claude.
- Use prompt caching (`anthropic.cache()`) on the lesson system prompt once transcript length exceeds ~1000 tokens. This cuts latency and cost significantly for repeated questions on the same lesson.

**Model selection:**
- Use `claude-sonnet-4-5` (or the current Sonnet generation) for the tutor. Haiku is too weak for nuanced lesson Q&A. Opus is overkill and expensive for interactive chat.

**Why NOT OpenAI / raw fetch:** The project is committed to Claude. The AI SDK's Anthropic provider is the cleanest way to use Claude in Next.js — it handles streaming protocol, error boundaries, and React state in one package.

---

## UI Component Library

### Recommended: shadcn/ui + Tailwind CSS v4 + Radix UI primitives
**Packages:**
- `tailwindcss@^4.x`
- `shadcn/ui` (not a package — it's a CLI: `npx shadcn@latest init`)
- `@radix-ui/react-*` (installed automatically by shadcn)
- `lucide-react@^0.400+` (icons)
- `next-themes@^0.3.x` (dark mode)

**Confidence: High**

shadcn/ui is the dominant choice for exactly this aesthetic in 2025. It is not a component library you install — you own the source code. Every component is copied into your `components/ui/` directory and is fully customizable. This is the right model for a premium product where pixel-level design control matters.

**Why this stack achieves the Linear/Vercel aesthetic:**
- shadcn's "New York" style variant with a zinc/slate dark base maps almost directly to the Linear color system.
- Tailwind v4 brings CSS-first configuration (no `tailwind.config.ts`) and significantly faster build times.
- Radix UI primitives (Dialog, Dropdown, Popover, etc.) provide fully accessible, unstyled behavior — you style them, Radix handles keyboard nav, focus traps, and ARIA.
- Lucide icons are clean, consistent, and actively maintained (unlike Heroicons which has slowed).

**Dark theme setup:**
```ts
// app/layout.tsx
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Force `defaultTheme="dark"` with `enableSystem={false}` — this is an enterprise product with a deliberate dark aesthetic. Don't let the OS override it.

**Recommended shadcn components to install immediately:**
`button`, `card`, `dialog`, `progress`, `badge`, `tabs`, `avatar`, `dropdown-menu`, `separator`, `skeleton`, `textarea`, `input`, `form`

**For the video progress bar and quiz UI:** build custom components on top of Radix `Progress` and `RadioGroup` primitives. Do not fight shadcn's defaults — extend them.

**Why NOT Chakra UI / MUI / Ant Design:** These are "batteries included" libraries with their own styling systems that fight Tailwind. They have opinionated light-mode defaults that are hard to override for a premium dark aesthetic. They add significant bundle weight.

**Why NOT Mantine:** Excellent library, but its design language skews utilitarian/functional, not premium dark. Getting it to look like Linear requires more effort than starting from shadcn.

**Why NOT Tremor:** Purpose-built for dashboards/data. Good for analytics pages but the component set is too narrow for a full e-learning product.

---

## State & Data Fetching

### Recommended: TanStack Query v5 + Zustand v5 (minimal use)
**Packages:**
- `@tanstack/react-query@^5.x`
- `zustand@^5.x`

**Confidence: High**

**The mental model for App Router:**

| Data type | Fetching strategy |
|---|---|
| Cohort data, lesson metadata, user enrollment | Server Component fetch (RSC, cached) |
| Real-time cohort progress | Supabase Realtime subscription (client component) |
| Quiz submissions, enrollment mutations | Server Actions |
| Client-side session data (chat history load, quiz state mid-attempt) | TanStack Query |
| Ephemeral UI state (sidebar open, modal open) | `useState` / Zustand |

**TanStack Query v5 rationale:**
RSCs handle most data fetching at the page level, but you need client-side data management for:
- Loading previous tutor chat messages from Supabase when the chat panel opens
- Invalidating and refetching quiz results after submission
- Optimistic updates on cohort progress

TanStack Query v5 introduces a cleaner `useSuspenseQuery` hook that integrates with React's Suspense model, which App Router uses. It also supports initializing from server-fetched data via `initialData`, so you avoid double-fetching.

```tsx
// Hydrate from RSC-fetched data, manage client updates with TanStack
const { data: lessons } = useQuery({
  queryKey: ["lessons", cohortId],
  queryFn: () => fetchLessons(cohortId),
  initialData: serverLessons, // passed from Server Component as prop
});
```

**Zustand v5 rationale:**
Use Zustand only for genuinely global, ephemeral UI state that does not belong in the server: current video timestamp (for resuming playback position), quiz attempt state (answers in progress before submission), and sidebar/panel open states. Do not put server data in Zustand — that's TanStack Query's job.

```ts
// store/playerStore.ts
import { create } from "zustand";

interface PlayerStore {
  currentTime: number;
  setCurrentTime: (t: number) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTime: 0,
  setCurrentTime: (t) => set({ currentTime: t }),
}));
```

**Why NOT SWR:** SWR is fine but TanStack Query v5 has better DevTools, better TypeScript inference, more granular cache invalidation, and superior support for mutations. SWR's simplicity advantage disappears in a moderately complex app.

**Why NOT Redux Toolkit:** Significant boilerplate for what this app needs. The App Router's RSC model removes most of the reasons Redux was needed in Next.js.

**Why NOT Jotai:** Excellent atomic model, but Zustand's slice pattern is simpler for a small team and the DevTools are better.

---

## Deployment

### Recommended: Vercel (app) + Supabase Cloud (managed)
**Confidence: High**

**Vercel** is the fastest path to a shareable demo URL for a Next.js project. Period.

- `vercel deploy` from the CLI or a GitHub push gives you a preview URL in under 2 minutes.
- Zero-config Next.js support: App Router, Route Handlers, Server Actions, Edge Runtime, and ISR all work without any `next.config.ts` tuning.
- Environment variables are managed in the Vercel dashboard and injected at build time — set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, and `MUX_TOKEN_ID`/`MUX_TOKEN_SECRET` there.
- Preview deployments per PR branch are automatic — every feature branch gets a unique URL. Essential for stakeholder demos.

**Deployment steps for the demo:**
1. Push repo to GitHub.
2. Connect repo in Vercel dashboard (`vercel.com/new`).
3. Set env vars in Vercel project settings.
4. Add Vercel domain to Supabase's "Allowed URL" list for OAuth redirects.
5. `git push origin main` → production URL live.

**Supabase Cloud (Free tier)** is sufficient for a demo:
- 500 MB database, 1 GB storage, 50,000 MAU on the free plan.
- No infrastructure to manage — Supabase handles Postgres, auth, storage, and realtime.
- Upgrade to Pro ($25/month) when you need > 8 GB storage or daily backups.

**Database migrations:** Use Supabase CLI (`supabase@^2.x`) with `supabase db push` for schema changes. Keep migration files in `supabase/migrations/` in the repo. This is mandatory — do not use the Supabase dashboard to make schema changes in an ad-hoc way.

**Why NOT Railway / Render / Fly.io for the Next.js app:** These are container-based platforms. Deploying Next.js on them requires a Dockerfile and manual configuration for App Router features. They add zero benefit for a Next.js app vs. Vercel, which is built by the same team.

**Why NOT self-hosting Supabase (Docker) for a demo:** Massive ops overhead. Use Supabase Cloud for the demo; self-host only if you have specific data residency requirements.

---

## What NOT to Use

### 1. `@supabase/auth-helpers-nextjs` (deprecated)
The old auth helpers package predates the App Router. It uses a session cookie pattern that does not work correctly with RSC/middleware in Next.js 15. Use `@supabase/ssr@^0.5.x` exclusively. Many tutorials still show the old package — ignore them.

### 2. `next-auth` (Auth.js) for auth
You are already paying for Supabase, which ships a full auth system (email/password, magic link, OAuth, SSO). Adding Auth.js creates two session systems that fight each other and doubles the complexity of every protected route. Use Supabase Auth natively via `@supabase/ssr`.

### 3. Raw Anthropic SDK (`@anthropic-ai/sdk`) called directly from client components
Never call the Anthropic API from the browser. Your API key would be exposed. All Claude calls must go through a Next.js Route Handler (`app/api/tutor/route.ts`). The Vercel AI SDK enforces this pattern correctly. Additionally, calling the raw SDK means writing your own streaming protocol — the AI SDK handles this.

### 4. `video.js` or `plyr` for the player
These are legacy players built for the era of direct MP4 serving. They have no concept of adaptive bitrate streaming, no CDN integration, and their dark-theme styling requires significant CSS overrides. Mux Player is purpose-built for HLS/DASH streams from a managed CDN with a modern Web Component architecture.

### 5. `react-query v4` or `swr` with a custom fetch layer replacing Server Components
A common over-engineering trap: using a client-side data fetching library as the primary way to fetch data that should simply be fetched in a Server Component. RSCs eliminate the need for `useEffect` + fetch for initial page data. Use TanStack Query only for data that is genuinely dynamic post-hydration (user interactions, invalidation after mutations). Starting with everything in `useQuery` hooks is a React 18 mistake applied to a Next.js 15 codebase.

---

## Summary — Full Dependency List

```json
{
  "dependencies": {
    "next": "^15.2.0",
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.45.0",
    "ai": "^4.3.0",
    "@ai-sdk/anthropic": "^1.1.0",
    "@mux/mux-player-react": "^2.9.0",
    "tailwindcss": "^4.0.0",
    "lucide-react": "^0.417.0",
    "next-themes": "^0.3.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@tanstack/react-query": "^5.56.0",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.0",
    "@hookform/resolvers": "^3.9.0"
  },
  "devDependencies": {
    "supabase": "^2.0.0",
    "@tanstack/react-query-devtools": "^5.56.0"
  }
}
```

> Note: `react-hook-form` + `zod` + `@hookform/resolvers` are included because quiz and auth forms need runtime validation. shadcn's `Form` component is built on this stack.

---

*Research based on ecosystem state as of April 2025. Versions are minimum recommended — use latest patch within each minor.*
