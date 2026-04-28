# Features Research

> **Platform context:** AI-native e-learning for enterprise cohorts. Mixed audiences (devs, PMs,
> business). Cohort model with scheduled start dates. Demo path: sign up → join cohort → watch
> video → quiz → AI chat. Post-demo additions: instructor tools, coding labs, peer chat,
> certificates.
>
> **Sources:** Synthesized from analysis of Coursera for Business, LinkedIn Learning, Degreed,
> Docebo, TalentLMS, Cornerstone, 360Learning, and patterns from enterprise LMS RFPs (2022–2025).

---

## Authentication & Onboarding

### Table Stakes

- **Email + password sign-up with email verification** — Industry baseline. Without it users assume
  the platform is unfinished or insecure.
- **SSO / SAML 2.0 (or OAuth via Google/Microsoft)** — Enterprise IT will block adoption without
  it. Admins will not manually provision hundreds of users. Even for demo, "Sign in with Google"
  covers this expectation cheaply.
- **Invite-based onboarding (magic link or token)** — Cohort model requires controlled enrollment.
  Users expect to receive an email link and land directly in their cohort, not hunt for it.
- **Org/team branding on login screen** — Enterprise buyers evaluate first impressions. A generic
  login page raises "is this ours?" questions in demos.
- **Password reset via email** — Non-negotiable hygiene. Absence signals the platform is a
  prototype.
- **Session persistence (stay logged in)** — Users return to a lesson days later. Forcing
  re-authentication on every visit kills retention metrics.

### Differentiators

- **Cohort-context landing after auth** — After sign-up or login, land the user inside their
  active cohort rather than a generic dashboard. Reduces orientation friction for new learners
  and signals the platform understands the cohort model.
- **Seat-based provisioning tied to HR/HRIS sync** — Auto-enroll employees when they join a
  team in Workday/BambooHR. Eliminates admin overhead at scale; not common outside tier-1
  enterprise LMS.
- **Role detection at sign-up (developer / PM / business)** — Collect job role during
  onboarding to power adaptive content sequencing later. Low-cost to add, high-value signal
  for personalization.
- **Onboarding checklist / progress ring** — Surface "3 of 5 steps to get started" immediately
  after sign-up. Reduces day-1 drop-off, which is the highest churn point in cohort-based
  courses.

### Anti-features (for demo scope)

- **Multi-factor authentication (TOTP/SMS)** — Valuable in production; adds friction to demo
  flows and requires phone/authenticator setup. Mock with a toggle in admin settings; implement
  post-launch.
- **Granular RBAC beyond learner/admin** — Custom permission sets per department/region are an
  enterprise requirement, not a demo requirement. Introduce two roles (learner, admin) now;
  expand later.
- **Full SCIM provisioning** — Complex IT integration. Flag as roadmap in sales conversations;
  do not build for v1.

---

## Course Catalog & Discovery

### Table Stakes

- **List of enrolled cohorts/courses on the dashboard** — The first screen after login must
  answer "what am I here to do?" without navigation. Platforms that require users to search for
  their own enrollment lose trust immediately.
- **Course title, description, and estimated duration** — Users and managers evaluate fit before
  starting. Absence of this metadata reads as incomplete content.
- **Visual progress indicator per course (% complete or module checklist)** — Learners need to
  know where they left off. A blank course card forces them to click in and scroll to find their
  place.
- **Module/lesson list within a course** — Learners plan their time. Hiding the syllabus until
  they start a lesson is a known frustration on platforms like older Coursera versions.

### Differentiators

- **Role-filtered content view** — Developers and PMs in the same cohort can see a shared core
  track plus role-specific supplementary material. Reduces "this isn't relevant to me"
  drop-off.
- **Recommended next content based on completion + role** — "People in your role who finished
  this module also took…" Simple collaborative filter; high perceived intelligence from users.
- **Cohort progress leaderboard (opt-in)** — Visible teammate completion fosters social
  accountability. 360Learning's data shows cohort visibility increases completion rates by
  ~25%. Must be opt-in to avoid toxic competition.
- **Manager/team catalog view** — Managers see their team's enrolled courses and aggregate
  progress without needing learner-level drill-down. Key in enterprise procurement conversations.

### Anti-features (for demo scope)

- **Open course marketplace / self-enrollment catalog** — The cohort model uses curated, admin-
  assigned enrollment. A browse-and-buy catalog introduces a different UX paradigm. Defer
  entirely; it is architecturally additive, not a refactor.
- **Content ratings and reviews** — Valuable at scale; meaningless in a cohort of 20 people.
  Adds moderation surface and noise to demo.
- **External content integrations (LinkedIn Learning, Pluralsight passthrough)** — License
  complexity, iframe constraints, and tracking gaps make this a post-v1 project. Mock as a
  "coming soon" card if needed for demo narrative.

---

## Cohort & Enrollment

### Table Stakes

- **Cohort start date and end date visibility** — Users and managers need scheduling context.
  "This cohort starts May 5" is the first question a learner asks after receiving an invite.
- **Cohort member roster (names + roles)** — Enterprise learners want to know who else is in
  their cohort. Absence of a roster makes the experience feel solo even in a cohort model,
  undermining the product's core value proposition.
- **Enrollment confirmation (email + in-app)** — Users need a receipt. Without it, support
  tickets spike ("am I actually enrolled?").
- **Locked lesson sequencing (unlock on schedule or prior completion)** — Cohort model requires
  pacing. If all lessons are open on day 1, learners race ahead or ignore the cohort schedule,
  destroying social learning dynamics.
- **Cohort status indicator** — "Starts in 3 days", "In progress – Week 2 of 4",
  "Completed" — learners need temporal orientation without doing date math.

### Differentiators

- **Cohort dashboard showing team progress at a glance** — A single screen with all cohort
  members, their current module, and a completion bar. This is the visual that sells the
  platform in demos: "your whole team, in sync."
- **Async catch-up path for late enrollees** — Enterprise cohorts frequently have members join
  late. A clearly marked "catch-up" path with condensed or self-paced content prevents
  stragglers from abandoning the cohort entirely.
- **Cohort-level milestone notifications** — "Your cohort just completed Module 2 — you're on
  track!" Peer progress as motivational signal, not just data.
- **Waitlist with auto-enrollment for next cohort** — Reduces admin burden; learners who miss a
  cohort are automatically placed in the next one. Common in Coursera for Business; rare in
  mid-market LMS.

### Anti-features (for demo scope)

- **Self-paced fallback mode** — A second, parallel enrollment model creates two UX paths, two
  progress models, and two sets of completion logic. Do not build for v1; enforce cohort-only.
- **Multiple simultaneous cohort enrollment** — Adds scheduling conflict logic, conflicting
  notification streams, and dashboard clutter. One active cohort per learner for v1.
- **Cohort templates / admin cohort creation wizard** — Necessary for instructors post-demo;
  seed demo cohorts directly in the database. Build the wizard in the instructor tools sprint.

---

## Lesson Experience

### Table Stakes

- **In-browser video playback (no download required)** — Users expect Netflix-style streaming.
  Any requirement to download, install a plugin, or leave the platform is an immediate
  trust-breaker.
- **Play / pause / seek controls with keyboard shortcuts** — Standard media player expectation.
  Space bar to pause is muscle memory; absence is jarring.
- **Playback speed control (0.75×, 1×, 1.25×, 1.5×, 2×)** — Power users watch at 1.5×;
  non-native speakers watch at 0.75×. This is table stakes since YouTube/Coursera normalized it.
- **Video resume from last position** — Users pause and return later. Restarting from the
  beginning is a documented top-3 frustration in LMS usability research.
- **Closed captions / subtitles** — Legal requirement (ADA/WCAG) for enterprise US customers.
  Also a demonstrated engagement driver (many watch with captions even without hearing
  impairment).
- **Lesson completion marking (auto on video end + manual override)** — Progress tracking
  depends on this. Auto-mark on ~90% watched; manual "mark complete" for users who need to skim.
- **Mobile-responsive layout** — Enterprise learners frequently complete lessons on commutes or
  during travel. A desktop-only experience loses a meaningful usage segment.

### Differentiators

- **Chapter / timestamp markers on the video scrubber** — "Jump to: Introduction | Key Concepts |
  Summary." Increases re-watch value and makes lessons scannable. Differentiates from basic
  video hosting.
- **In-video knowledge checks (inline quiz pop-ups)** — Pause the video at a key moment and ask
  a question before continuing. Proven retention technique (spaced retrieval); not standard in
  most LMS video players.
- **Transcript panel with search and click-to-seek** — Click a word in the transcript and jump
  to that moment. Extremely high perceived value for technical content; learners use it as
  documentation. LinkedIn Learning built its brand partly on this feature.
- **Lesson-level AI summary (auto-generated)** — "Here are the 5 key takeaways from this
  lesson." Low cost to generate at content-creation time; high value for review and for
  learners who skim before committing.
- **Adaptive video quality (HLS/DASH streaming)** — Handles varying enterprise network
  conditions (VPN, hotel Wi-Fi). Users on corporate networks often have unpredictable bandwidth.

### Anti-features (for demo scope)

- **Downloadable video / offline mode** — DRM, storage, and sync complexity. Enterprise use case
  exists (travel) but is a post-v1 feature. Mark as roadmap.
- **360° / VR video** — Niche enterprise use case (safety training). Incompatible with cohort
  demo scope.
- **Live video streaming / webinars within the platform** — Zoom/Teams integration is cheaper
  and better than building live streaming. Embed an external link if live sessions are needed;
  do not rebuild video conferencing.
- **User-uploaded video responses** — Video assignments add storage, moderation, and review
  workflows. Meaningful post-demo; do not include in v1.

---

## AI Features

### Table Stakes

- **Conversational AI assistant scoped to course content** — Users expect to ask "explain this
  concept differently" or "what did the instructor mean by X?" Without a contextually grounded
  assistant, the AI label is marketing, not product. The assistant must cite or reference
  specific lesson content, not give generic answers.
- **Persistent chat history within a lesson/course** — Users return and expect their prior
  questions to still be there. Stateless chat resets the context users built up over days of
  learning.
- **Graceful refusal for out-of-scope questions** — "I'm here to help with this course. For
  general coding help, try Stack Overflow." Without scope guardrails, the assistant becomes a
  free-floating chatbot and the enterprise IT/legal review gets complicated.
- **Visible AI disclosure** — Users must know they are talking to an AI. Required by emerging
  EU AI Act provisions and standard enterprise trust expectations.

### Differentiators

- **Role-aware AI responses** — The assistant gives a Python code example to the developer
  cohort member and a process-flow analogy to the PM asking the same question. Requires role
  signal from onboarding; high perceived intelligence with minimal additional model complexity.
- **AI-generated quiz explanations** — After a wrong answer, the assistant explains why the
  correct answer is correct with reference to the specific lesson section. Closes the feedback
  loop that traditional static answer explanations break open.
- **Proactive AI nudges based on struggle signals** — If a learner re-watches the same 2-minute
  segment three times or fails a quiz twice, the AI surfaces: "It looks like this concept is
  tricky. Want me to explain it a different way?" Requires event instrumentation but not
  complex ML.
- **AI-generated lesson summaries and concept maps** — Pre-generated at content-creation time,
  surfaced to learners as study aids. Differentiates from raw video hosting; positions the
  platform as a learning accelerator, not just a video player.
- **AI progress coach (weekly digest)** — "You're 60% through the cohort. Based on your pace,
  you'll finish on time if you complete Module 3 by Thursday." Converts passive progress data
  into actionable coaching without a human instructor. Directly addresses enterprise ROI
  narrative.
- **Semantic search across course content** — Ask "where did we cover caching strategies?" and
  get timestamped video hits across all lessons. Transforms the course into a searchable
  knowledge base post-completion.

### Anti-features (for demo scope)

- **AI content generation / course authoring assistant** — Instructor-side AI tooling is
  explicitly post-demo scope. Building it before the learner-side AI is proven is a product
  sequencing mistake.
- **AI peer-matching ("find a study buddy")** — Requires a critical mass of learners and a peer
  chat surface that is also post-demo. No data to match on with seeded demo data.
- **Fine-tuned custom model per enterprise customer** — Operationally complex, expensive, and
  unnecessary when RAG over course content achieves contextual grounding. Do not over-engineer
  the AI stack for v1.
- **AI voice assistant / text-to-speech responses** — Adds audio complexity, latency, and
  accessibility edge cases. Text chat covers the demo use case.
- **AI-generated certificates or credential verification** — Intersects with legal/accreditation
  questions. Certificates are post-demo; AI certificates are post-post-demo.

---

## Progress & Completion

### Table Stakes

- **Per-lesson completion state (complete / in-progress / not started)** — The visual checklist
  is how learners navigate and how managers verify participation. Without it, the platform has
  no accountability layer.
- **Overall course progress percentage** — The single number a manager asks in a 1:1. Must be
  accurate and real-time.
- **Quiz score visibility to learner** — Users expect to see their score immediately after
  submission and be able to review correct/incorrect answers. Withholding scores is a known
  frustration on older corporate LMS platforms (e.g., SuccessFactors).
- **Cohort-level progress visible to learner** — Core to the cohort value proposition. Learners
  need to see where they stand relative to teammates to activate social accountability.
- **Email notifications for key milestones** — "You completed Module 1," "Your cohort starts
  tomorrow," "You're falling behind." Email is the enterprise communication channel; in-app-only
  notifications miss users who are not daily-active.

### Differentiators

- **Manager dashboard with team-level completion view** — Aggregate completion rates, quiz
  scores, and time-in-platform per employee. The manager view is frequently the reason an
  enterprise buys a platform; it converts learning into a reportable KPI.
- **Streak and consistency tracking** — "You've logged in 5 days in a row." Low-effort
  engagement mechanism that outperforms one-time completion badges in retention research.
  Duolingo popularized this; enterprise learners respond to it when framed professionally.
- **Predictive completion risk flag** — Flag learners who are statistically likely to not finish
  based on activity patterns (page views, video completion rate, quiz attempts). Enables
  proactive manager/instructor intervention. Requires 2–3 weeks of cohort data to be meaningful.
- **Exportable progress report (CSV/PDF)** — Enterprise L&D teams run reports for compliance,
  board decks, and budget justification. A one-click export is a procurement requirement in
  most enterprise RFPs.
- **Granular time-on-task tracking** — Minutes of active video playback, quiz time, AI chat
  turns per lesson. Finer-grained than simple completion; useful for content quality analysis
  (high drop-off on a specific video segment = content problem).

### Anti-features (for demo scope)

- **Certificates of completion** — Explicitly called out as post-demo. Requires design,
  verification logic (did they actually pass?), and sometimes legal review for regulated
  industries. Seed a "coming soon" placeholder.
- **Compliance / regulatory training tracking (SCORM, xAPI)** — SCORM packaging and xAPI
  statement plumbing are significant engineering effort for a use case that is adjacent to the
  core product. Enterprise compliance training is a separate market segment.
- **Leaderboards with rankings and points economy (full gamification)** — Opt-in cohort
  progress visibility (listed under Differentiators) is appropriate. A full gamification system
  with points, badges, and global leaderboards introduces motivational psychology risks (anxiety,
  gaming behavior) and design complexity that is not warranted for v1.
- **360-degree feedback / peer review grading** — Requires a separate review workflow, rubric
  builder, and calibration system. High complexity, low demo value.

---

## Demo Scope Notes

### Must work end-to-end (no mocking)

| Flow step | Why it cannot be faked |
|---|---|
| Sign up with email or Google OAuth | First impression; broken auth kills all trust |
| Receive invite link and join a cohort | Core product hypothesis being tested |
| See cohort dashboard with teammates | Visual proof of the cohort model |
| Open a lesson and watch a video with resume | Primary learning interaction |
| Submit a quiz and see score + answer review | Closes the learning loop |
| Open AI chat and ask a course-scoped question | The product's main differentiator |
| AI chat responds with lesson-grounded answer | Differentiator only works if grounding works |
| Progress updates after lesson/quiz completion | Proves the data model is live |

### Can be seeded / mocked for demo

| Element | Approach |
|---|---|
| Cohort roster (teammates) | Seed 4–6 fake users with realistic names, roles, and partial progress |
| Course catalog | Seed 1–2 courses; do not build a catalog browser |
| Video content | Use 2–3 short real videos (5–10 min each); do not build a content upload system |
| Manager dashboard | Static or lightly seeded; show aggregate numbers; no drill-through required |
| Email notifications | Send real emails for invite and completion; skip streak/nudge emails |
| AI knowledge base | Pre-index lesson transcripts; no admin UI needed for v1 |
| Certificates | Placeholder UI: "Certificate available upon cohort completion" |

### Key dependencies and sequencing risks

- **AI chat quality is gated on transcript ingestion.** If video transcripts are not indexed
  before the demo, the AI assistant gives generic (non-grounded) answers, which kills the
  differentiator narrative. Transcript pipeline must be built before AI chat.
- **Progress state is a shared dependency.** Lesson completion feeds cohort dashboard, AI nudges,
  manager dashboard, and email notifications. Build and test the progress event model first;
  everything else reads from it.
- **Role signal (dev / PM / business) must be collected at sign-up** to enable role-aware AI
  responses. This is a one-field addition to the onboarding form but must not be retrofitted
  after the AI prompt engineering is done.
- **Video player resume requires a watch-position API.** Do not use a static CDN embed (YouTube,
  Vimeo) for the demo unless the embed supports postMessage position tracking. A custom player
  wrapper or a service like Mux/api.video gives this cleanly.
- **Cohort locking logic (lesson unlock schedule) must be decided before content is seeded.**
  Retroactively changing unlock rules breaks demo flow rehearsals. Lock to cohort start date +
  weekly module unlocks as the default model.
