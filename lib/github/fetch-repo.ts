// lib/github/fetch-repo.ts
//
// Pulls a code-text snapshot of a public GitHub repo for evaluation.
//
// Strategy:
//   1. Parse {owner, repo} from the URL.
//   2. GET /repos/{owner}/{repo} → default branch + size sanity check.
//   3. GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1 → file tree.
//   4. Filter: skip vendor dirs, skip non-code files, cap to N candidates.
//   5. For each candidate, GET /repos/{owner}/{repo}/contents/{path} and
//      base64-decode. Stop once we hit TOTAL_BYTES_BUDGET.
//
// Auth: GITHUB_TOKEN (optional). Public-only — no OAuth flow.

import { env } from '@/lib/env'

const GITHUB_API = 'https://api.github.com'

const TOTAL_BYTES_BUDGET = 150_000 // ~150 KB of code text → keeps prompts cheap.
const MAX_CANDIDATE_FILES = 200 // hard cap before any selection happens.
const PER_FILE_MAX_BYTES = 32_000 // skip any single file over this.
const MAX_TREE_FILES = 4_000 // refuse pathologically huge repos.

const VENDOR_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.cache',
  '.idea',
  '.vscode',
  'dist',
  'build',
  'out',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  'target', // rust/java
  '.gradle',
  'vendor',
  '.pnpm',
  '.yarn',
])

const CODE_EXTENSIONS = new Set([
  // JS/TS
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  // Python
  'py', 'pyi',
  // Common backend
  'go', 'rs', 'java', 'kt', 'rb', 'php', 'cs', 'cpp', 'c', 'h', 'hpp',
  // Web
  'html', 'css', 'scss',
  // Config/markdown that often matters
  'md', 'mdx', 'json', 'yaml', 'yml', 'toml',
  // Shell
  'sh', 'bash',
  // SQL
  'sql',
])

const URL_RE = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/

export type GitHubFetchError = { code: string; message: string; status?: number }

export type GitHubRepoSnapshot = {
  owner: string
  repo: string
  defaultBranch: string
  totalFiles: number
  fetchedFiles: Array<{ path: string; size: number; content: string }>
  truncatedReason: 'budget' | 'cap' | null
  totalBytes: number
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const m = URL_RE.exec(url.trim())
  if (!m) return null
  return { owner: m[1], repo: m[2] }
}

function authHeaders(): HeadersInit {
  return env.githubToken
    ? { Authorization: `Bearer ${env.githubToken}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' }
}

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: authHeaders(),
    // Mark all GitHub fetches as no-store — repo state is mutable and we
    // never want to serve a stale copy when re-evaluating a submission.
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err: GitHubFetchError = {
      code: res.status === 404 ? 'NOT_FOUND' : res.status === 403 ? 'RATE_LIMITED' : 'HTTP_ERROR',
      status: res.status,
      message: `GitHub ${res.status}: ${body.slice(0, 200)}`,
    }
    throw err
  }
  return (await res.json()) as T
}

// Decide whether a path is something an evaluator cares about.
function isCandidateFile(path: string): boolean {
  // Skip files inside any vendor dir.
  const segments = path.split('/')
  for (const seg of segments) {
    if (VENDOR_DIRS.has(seg)) return false
  }
  // Top-level README is always a candidate even if extension is missing.
  const lower = path.toLowerCase()
  if (segments.length === 1 && /^readme(\.|$)/i.test(segments[0])) return true

  const dot = path.lastIndexOf('.')
  if (dot < 0) return false
  const ext = path.slice(dot + 1).toLowerCase()
  if (!CODE_EXTENSIONS.has(ext)) return false

  // Skip lockfiles and minified bundles — pure noise for an evaluator.
  if (/-lock\.(json|yaml|yml)$/i.test(lower)) return false
  if (/\.min\.(js|css)$/i.test(lower)) return false
  if (/package-lock\.json$/i.test(lower)) return false
  if (/yarn\.lock$/i.test(lower)) return false
  if (/pnpm-lock\.yaml$/i.test(lower)) return false

  return true
}

// Heuristic priority — README first, then likely source roots, then everything else.
// The evaluator gets a reasonable picture even if the budget cuts off.
function fileScore(path: string): number {
  const lower = path.toLowerCase()
  if (/^readme(\.|$)/i.test(path.split('/')[0])) return 1000
  if (lower.includes('/main.') || lower.endsWith('main.py') || lower.endsWith('index.ts') || lower.endsWith('index.js')) return 800
  if (lower.includes('/app/') || lower.startsWith('app/')) return 600
  if (lower.includes('/src/') || lower.startsWith('src/')) return 500
  if (lower.includes('/lib/') || lower.startsWith('lib/')) return 400
  if (lower.endsWith('.md')) return 300
  if (/(test|spec)\./i.test(lower)) return 250
  return 100
}

type RepoMeta = { default_branch: string; size: number; private: boolean }
type TreeNode = { path: string; type: 'blob' | 'tree' | 'commit'; size?: number }
type TreeResponse = { tree: TreeNode[]; truncated: boolean }
type ContentResponse = { content: string; encoding: string; size: number }

export async function fetchPublicRepoSnapshot(url: string): Promise<GitHubRepoSnapshot> {
  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    throw <GitHubFetchError>{ code: 'BAD_URL', message: 'Not a valid GitHub repo URL.' }
  }
  const { owner, repo } = parsed

  const meta = await ghJson<RepoMeta>(`${GITHUB_API}/repos/${owner}/${repo}`)
  if (meta.private) {
    throw <GitHubFetchError>{ code: 'PRIVATE', message: 'Private repos are not supported.' }
  }
  const branch = meta.default_branch || 'main'

  const tree = await ghJson<TreeResponse>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
  )

  const blobs = tree.tree.filter((n) => n.type === 'blob')
  if (blobs.length > MAX_TREE_FILES) {
    throw <GitHubFetchError>{
      code: 'REPO_TOO_LARGE',
      message: `Repo has ${blobs.length} files (cap ${MAX_TREE_FILES}). Submit a smaller repo.`,
    }
  }

  const candidates = blobs
    .filter((b) => isCandidateFile(b.path))
    .filter((b) => (b.size ?? 0) <= PER_FILE_MAX_BYTES)
    .sort((a, b) => fileScore(b.path) - fileScore(a.path))
    .slice(0, MAX_CANDIDATE_FILES)

  const fetchedFiles: GitHubRepoSnapshot['fetchedFiles'] = []
  let totalBytes = 0
  let truncatedReason: GitHubRepoSnapshot['truncatedReason'] = null

  for (const node of candidates) {
    if (totalBytes >= TOTAL_BYTES_BUDGET) {
      truncatedReason = 'budget'
      break
    }
    try {
      const content = await ghJson<ContentResponse>(
        `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIPath(node.path)}?ref=${encodeURIComponent(branch)}`,
      )
      if (content.encoding !== 'base64') continue
      const decoded = Buffer.from(content.content, 'base64').toString('utf8')

      // Skip likely-binary files that slipped past the extension filter.
      if (looksBinary(decoded)) continue

      fetchedFiles.push({ path: node.path, size: decoded.length, content: decoded })
      totalBytes += decoded.length
    } catch {
      // Individual file fetch failures (404, rate limit) shouldn't kill the
      // whole snapshot — just skip and continue.
      continue
    }
  }

  if (fetchedFiles.length === MAX_CANDIDATE_FILES && totalBytes < TOTAL_BYTES_BUDGET) {
    truncatedReason = 'cap'
  }

  return {
    owner,
    repo,
    defaultBranch: branch,
    totalFiles: blobs.length,
    fetchedFiles,
    truncatedReason,
    totalBytes,
  }
}

function encodeURIPath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/')
}

// A 0x00 (NUL) byte in the first 1KB is the simplest, fastest binary
// heuristic. Use the escape sequence \u0000 in source rather than a
// literal NUL so code reviewers (human or AI) do not misread it as a space.
function looksBinary(text: string): boolean {
  const sample = text.slice(0, 1024)
  return sample.includes('\u0000')
}
