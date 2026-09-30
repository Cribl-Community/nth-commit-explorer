# App Definition

## App ID
nth-commit-explorer

## Problem
Cribl's built-in UI only exposes commits one at a time, with no ability to search by date, user, or file changed. It also has no "blame" capability to know who changed what and when.

## Target Users
Cribl Admins

## Workflows

### Workflow 1: Browse, Filter, Diff, and Blame Commits
1. User lands on the app with a header showing the app title, a Worker Group dropdown (pre-populated with the first available group, restricted to `type === 'stream'` groups only), and a dark/light mode toggle.
2. Below the header, a GitHub-style commit activity heatmap (calendar of daily commit counts, 8–104 weeks depending on data range) renders for the currently filtered commit set. Hovering a day shows a tooltip listing that day's commits (hash, author, message).
3. The main view is a master-detail layout: a commit list on the left, detail panel on the right.
4. The commit list can be filtered by: free-text search (message or author), author (dropdown), and a date range (either a quick preset — Last 7/30/90 days, Last 6 months — or explicit From/To date pickers). Defaults to the last 30 days on load. Only the 100 most recent commits are fetched per Worker Group (a hard limit, independent of the date filter, to avoid timing out Cribl's proxy on groups with long history); if the oldest of those 100 commits is more recent than 30 days ago, a notice banner tells the user that older commits within the default 30-day window weren't loaded.
5. An "Exclude default paths" checkbox (on by default) hides commits/files whose changed paths contain "default" (Cribl's auto-written default-group boilerplate) — unless the path also contains "local", which marks it as a real user customization even under a default-named directory, so those are never hidden. Applied both to the commit list and the file list.
6. Selecting a commit shows the list of files changed, each annotated as added/modified/deleted/renamed, filterable by filename search and by detected pack name (parsed from `packs/<name>/...` paths).
7. Selecting a file shows a GitHub-styled colored diff, with a button to return to the file list.
8. From a selected file's diff, a "Blame" button adds a per-line blame column (commit hash/author/date, with full commit message on hover) directly inline in the diff view, built by replaying the file's diff history backward across up to N prior commits (a "commits back" number input next to the Blame button, defaulting to 50). Blame fetches its own commit history as needed to reach that depth — it isn't limited by however many commits the group's commit list has loaded.

### Workflow 2: Generate Summary / Generate Report
1. After filtering a set of commits (per Workflow 1), the user clicks "Generate Summary" or "Generate Report" (mutually exclusive while running; both show a live progress counter).
2. **Generate Summary** opens a separate HTML tab with two tables: a per-author rollup (commits, added/modified/deleted file counts, total) and a full commit list grouped by month, with per-commit add/modify/delete counts. Includes a "Download" button that saves the standalone HTML file.
3. **Generate Report** opens a separate HTML tab with one expandable line per commit showing a summary of files added/modified/deleted, commit ID, author, date, and commit message. Expanding a commit shows one expandable line per file (state + path); expanding a file shows its colored diff. Also includes a "Download" button.
4. Both reports respect the "Exclude default paths" setting from Workflow 1.

### Workflow 3 (In Progress, not user-reachable): AI Copilot Summary
The UI and API plumbing exist for an AI-generated natural-language summary of a selected commit set (`CopilotSummary` component, `summarizeWithCopilot` in `api.ts`, posting to Cribl's `/ai/event` Copilot endpoint), but there is currently no button or menu item wired up to trigger it, and the API call itself is a debug stub that always throws with the raw HTTP response instead of returning parsed summary text. Treat this as a planned/nice-to-have feature, not working functionality.

## Data & Integration Points

### Data Display
Data from Cribl's Git API only: worker groups (`/master/groups`, filtered to `type === 'stream'`), commits (`/m/{groupId}/version`), commit file lists (`/m/{groupId}/version/files`), and file diffs (`/m/{groupId}/version/show`). Blame is derived client-side by replaying diffs, not a dedicated blame endpoint.

### Create/Modify/Delete
None — the app is strictly read-only.

### External Integrations
None beyond Cribl's own API today. A Cribl AI Copilot integration (`/ai/event`) exists in code for natural-language commit summaries but is not yet functional or reachable from the UI — see Workflow 3.

## Permissions & Access

### Different Users See Different Data?
No — every Cribl Admin who can open the app sees the same data.

### Permission-Denied Behavior
If a user lacks permission to view a worker group's git data, show an error.

## State & Secrets

### Saved State
Light/dark mode preference, persisted as a shared value in Cribl's app-scoped KV store (`/kvstore/theme`) — not per-user, so every admin who opens the app sees (and can change) the same theme. Falls back to the OS `prefers-color-scheme` on first load or if the KV read fails. Last-viewed worker group is not currently persisted — it resets to the first available Stream group on every load.

### General Settings
Light/dark mode preference (see Saved State above) — shared across all users of the app.

### User-Specific Settings
None.

### Secure Secrets
None beyond what Cribl's fetch proxy already handles automatically.

## Scope

### Must-Have (MVP)
Everything described in Workflows 1 and 2: Stream worker group selection, commit browsing/filtering (by author, date range/presets, message/author text search), commit activity heatmap, "Exclude default paths" filtering, file diff view, inline blame view, and Generate Summary / Generate Report. Also includes a fallback screen when the app is opened outside Cribl (no `CRIBL_API_URL`).

### Nice-to-Have (Defer)
Finish and expose the AI Copilot commit-summary feature (Workflow 3) — parse the real Copilot response and add a UI trigger for it.

### Out of Scope
Non-Stream worker groups (e.g. Edge) — the group list is currently filtered to `type === 'stream'` only.

## UI Preferences

### Overall Structure
Single-page app: header (title, Worker Group dropdown, dark/light toggle) → commit activity heatmap → master-detail table layout (commit list left, file/diff/blame detail right).

### Look/Feel
React 19 + Vite + TypeScript (strict), with Vitest and oxlint. IBM Plex Sans / Mono self-hosted (bundled, no external font requests). No runtime dependencies beyond React. GitHub-styled colored diff and inline blame column (per Workflow 1), GitHub-style contribution heatmap for commit activity.
