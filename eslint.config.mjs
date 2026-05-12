import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // ──────────────────────────────────────────────────────────────────
  // CLAUDE.md layer rule #1 — service-role isolation.
  //
  // `@/lib/supabase/admin` exposes `createAdminClient`, which bypasses
  // RLS. It MUST NOT be imported from UI surfaces (Server/Client
  // Components, layouts, regular components) or from non-admin route
  // handlers. The exceptions block below carves out the directories
  // where it IS allowed.
  // ──────────────────────────────────────────────────────────────────
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/admin", "**/lib/supabase/admin"],
              message:
                "Do not import `createAdminClient` from UI / non-admin routes. " +
                "Service-role queries belong in `lib/queries/admin/*`, `lib/storage/*`, " +
                "`lib/actions/*.actions.ts`, `lib/labs/*`, `lib/learner-stats.ts`, or " +
                "`app/api/admin/**/route.ts`. See CLAUDE.md → Layer rules → rule #1.",
            },
          ],
        },
      ],
    },
  },

  // Allow `createAdminClient` in the modules where service-role is the
  // intended boundary. Keep this list narrow; if a new path needs to
  // touch it, prefer extracting a helper in `lib/**` first.
  {
    files: [
      "lib/**/*.{ts,tsx}",
      "app/api/admin/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
