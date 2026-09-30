# Nth Commit Explorer - App Brief

## App ID
nth-commit-explorer

## Problem & Vision
Cribl's built-in UI only exposes commits one at a time, with no ability to search by date, user, or file changed, and no "blame" capability to know who changed what and when. This app gives Cribl Admins a searchable, filterable commit history for a Stream worker group — with diffs, inline blame, a commit activity heatmap, and exportable summary/report views — so they can quickly understand who changed what, when, and why.

## Target Users
Cribl Admins.

## Key Workflows

### Workflow 1: Browse, Filter, Diff, and Blame Commits
- **User sees**: A header with the app title, a Worker Group dropdown (pre-populated with the first available group, restricted to `type === 'stream'` groups only) and a dark/light mode toggle; below it, a GitHub-style commit activity heatmap (8–104 weeks depending on data range, hover tooltip listing that day's commits); below that, a master-detail layout — commit list on the left, detail panel on the right.
- **User does**: Filters the commit list by free-text search (message or author), author (dropdown), and date range (quick presets — Last 7/30/90 days, Last 6 months — or explicit From/To pickers; defaults to last 30 days). Toggles "Exclude default paths" (on by default) to hide commits/files whose changed paths contain "default" (Cribl's auto-written default-group boilerplate) — except paths that also contain "local", which are real user customizations and are never hidden even under a default-named directory. Selects a commit to see its changed files (added/modified/deleted/renamed), filterable by filename search and by detected pack name (parsed from `packs/<name>/...` paths). Selects a file to view a GitHub-styled colored diff, with a button to return to the file list. From a file's diff, clicks "Blame" to add a per-line blame column (commit hash/author/date, full message on hover) inline in the diff; a "commits back" number input next to the Blame button (default 50) controls how far back blame searches for that file.
- **Result**: A filtered, explorable view of commit history, file changes, diffs, and per-line blame, without needing to page through Cribl's native one-commit-at-a-time UI. Only the 100 most recent commits are fetched per Worker Group for the commit list itself — a fixed cap, independent of the date filter, chosen to avoid timing out Cribl's 30-second fetch-proxy limit on groups with long history. The cap always wins over the date filter: if the oldest of the 100 fetched commits is more recent than 30 days ago, a warning banner tells the user that older commits within the default 30-day window weren't loaded. Blame is computed client-side by replaying the selected file's diff history backward across up to the requested "commits back" depth (default 50); it fetches its own, independently-sized commit history on demand when it needs to look further back than what the commit list already loaded, so its reach is decoupled from the 100-commit cap above — no data is created or modified.
- **Permissions**: All Cribl Admins who can open the app see the same data; no per-user data variation. If a user lacks permission to view a worker group's git data, show an error.

### Workflow 2: Generate Summary / Generate Report
- **User sees**: Two buttons above the commit list, "Generate Summary" and "Generate Report" (mutually exclusive while either is running; both show a live progress counter of commits processed).
- **User does**: Clicks one of the two buttons against the currently filtered commit set (respecting the "Exclude default paths" setting from Workflow 1).
- **Result**: **Generate Summary** opens a new HTML tab with two tables — a per-author rollup (commits, added/modified/deleted file counts, total) and a full commit list grouped by month with per-commit add/modify/delete counts — plus a "Download" button that saves the standalone HTML file. **Generate Report** opens a new HTML tab with one expandable line per commit (summary of files added/modified/deleted, commit ID, author, date, message); expanding a commit shows one expandable line per file (state + path); expanding a file shows its colored diff. Also has a "Download" button.
- **Permissions**: Same as Workflow 1 — no additional restrictions.

### Workflow 3 (In Progress, not user-reachable): AI Copilot Summary
- **User sees**: Nothing today — there is no button or menu item wired up to trigger this.
- **User does**: N/A (not reachable from the UI).
- **Result**: The UI (`CopilotSummary` component) and API plumbing (`summarizeWithCopilot` in `api.ts`, posting to Cribl's `/ai/event` Copilot endpoint) exist for an AI-generated natural-language summary of a selected commit set, but the API call is currently a debug stub that always throws with the raw HTTP response instead of returning parsed summary text. Do not treat this as working functionality — it needs the response parsing finished and a UI trigger added before it's real (tracked as Nice-to-Have, see MVP Scope).
- **Permissions**: Same as Workflow 1 (once completed).

## Data & Actions

**The app will fetch from Cribl:**
- Worker groups (`/master/groups`, filtered client-side to `type === 'stream'`): populates the Worker Group dropdown (Workflow 1)
- Commits (`/m/{groupId}/version`): populates the commit list, heatmap, and filters (Workflow 1)
- Commit file lists (`/m/{groupId}/version/files`): populates the changed-files list per commit, and drives "Exclude default paths" filtering and report/summary generation (Workflows 1 & 2)
- File diffs (`/m/{groupId}/version/show`): powers the diff viewer, blame (replayed client-side across diffs), and report/summary generation (Workflows 1 & 2)

**The app will create/modify/delete in Cribl:**
- None — the app is strictly read-only.

**The app will remember (general state):**
- Light/dark mode preference — a single shared value stored in Cribl's app-scoped KV store (`/kvstore/theme`), not per-user, so every admin who opens the app sees (and can change) the same theme. Falls back to the OS `prefers-color-scheme` on first load or if the KV read fails.

**User-specific settings (stored per user):**
- None. (Last-viewed worker group is not currently persisted; it resets to the first available Stream group on every load.)

**Secure secrets:**
- None beyond what Cribl's fetch proxy already handles automatically.

## UI Structure

### Overall Layout
Single-page app: header (title, Worker Group dropdown, dark/light toggle) → commit activity heatmap → master-detail table layout (commit list left, file/diff/blame detail right).

### Key Screens/Pages
1. **Main view**: Header + heatmap + master-detail commit browser (Workflow 1), including the "Generate Summary" / "Generate Report" actions (Workflow 2).
2. **No-API fallback**: Shown when the app is opened outside Cribl (no `CRIBL_API_URL` available) — header only, with an explanatory message.
3. **Summary report (new tab)**: Standalone HTML page — per-author rollup table + monthly commit table, with a Download button.
4. **Diff/commit report (new tab)**: Standalone HTML page — expandable commit → file → diff tree, with a Download button.

## Permissions & Access
- **Who can use this app?**: All Cribl Admins.
- **Permission-aware behavior**: If a user lacks permission to view a worker group's git data, show an error rather than partial or silently-empty data.

## External Integrations (if any)
None today. A Cribl AI Copilot integration (`/ai/event`) exists in code for natural-language commit summaries but is not yet functional or reachable from the UI (Workflow 3) — do not treat it as a shipped integration.

## MVP Scope
**Must-have:**
- Stream worker group selection
- Commit browsing/filtering (author, date range/presets, message/author text search)
- Commit activity heatmap
- "Exclude default paths" filtering
- File diff view
- Inline per-line blame
- Generate Summary
- Generate Report
- Fallback screen when opened outside Cribl (no `CRIBL_API_URL`)

**Nice-to-have (defer):**
- Finish and expose the AI Copilot commit-summary feature — parse the real Copilot response and add a UI trigger for it

**Out of scope:**
- Non-Stream worker groups (e.g. Edge) — the group list is filtered to `type === 'stream'` only

## Edge Cases & Error Handling
- **If the 100-commit fetch cap cuts off before the default 30-day window**: Show a warning banner naming the actual coverage (e.g. "back to <oldest commit date>") rather than silently displaying an incomplete "last 30 days" view.
- **If user lacks permission**: Show an error rather than partial or empty data.
- **If data is unavailable**: Show an explanatory error/empty state (e.g. no `CRIBL_API_URL` → fallback screen with instructions; failed fetch of groups/commits/files/diffs → inline error message rather than silently failing).
- **If an action fails**: Blame fetch failures show a blame-specific error and exit blame mode rather than showing stale data; diff fetch failures show a diff-specific error state; report/summary generation failures per-commit are skipped/noted rather than aborting the whole run; Copilot summary failures (Workflow 3, once wired up) should show a retry option.

## Implementation guidance (include this section verbatim)
- Read AGENTS.md first
- Then read openapi.json
- NEVER EVER use local storage 
