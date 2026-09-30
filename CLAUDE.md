# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed. 

Provide guidance to Claude Code when working with this Cribl app.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## App Context

This app is defined in `APP_DEFINITION.md` — read that for the full problem statement, workflows, and scope.

**Key References:**
- `AGENTS.md` — how to build the app and navigate the app runtime environment
- `APP_DEFINITION.md` — full app requirements and workflows

**Main Workflows:**
- Browse, filter, diff, and blame commits for a selected Stream worker group (author/date/text filters, date presets, commit heatmap, "Exclude default paths" toggle, inline per-line blame in the diff view)
- Generate Summary (author rollup + monthly commit table) or Generate Report (full expandable diff report) for the currently filtered commits, each opening as a downloadable standalone HTML file in a new tab
- AI Copilot commit summary — UI/API plumbing exists (`CopilotSummary`, `summarizeWithCopilot` in `api.ts`) but is **not yet functional**: no UI trigger is wired up, and the API call is a debug stub that always throws with the raw HTTP response. Don't treat this as working functionality without finishing it.

**Key Data:**
- Displays only data from Cribl's Git API: worker groups (filtered to `type === 'stream'`), commits, commit file lists, and file diffs. Blame is derived client-side by replaying diffs, not a dedicated endpoint.
- Strictly read-only — the app never creates, modifies, or deletes anything via the API.
- No external integrations beyond Cribl's own API (the Copilot `/ai/event` call above is unfinished, not a shipped integration).

## UI Structure

- Single-page app: header (title, Worker Group dropdown, dark/light toggle) → commit activity heatmap → master-detail layout (commit list left, file/diff/blame detail right).
- Fallback screen when opened outside Cribl (no `CRIBL_API_URL`).

## MVP Scope

**Must-have (shipped):**
- Stream worker group selection, commit browsing/filtering (author, date range/presets, text search), commit activity heatmap, "Exclude default paths" filtering, file diff view, inline blame, Generate Summary, Generate Report

**Nice-to-have (defer):**
- Finish and expose the AI Copilot commit-summary feature — parse the real Copilot response and add a UI trigger

**Out of scope:**
- Non-Stream worker groups (e.g. Edge) — the group list is filtered to `type === 'stream'` only

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Tech Constraints

- React 19 + Vite + TypeScript (strict), Vitest, oxlint
- IBM Plex Sans / Mono self-hosted (bundled, no external font requests)
- No runtime dependencies beyond React
- Strictly read-only against Cribl's Git API; no secrets beyond Cribl's automatic fetch proxy auth

## Additional Guidance

- Read the [Cribl Apps Builder Guide](https://docs.cribl.io/apps/builder-guide/) for patterns and best practices
- Check `/app-brief` and `/app-validate` skills for guidance before implementation
