---
name: alcatraz-commit
description: How to commit atomically in Alcatraz — one logical unit per commit, scoped to the finished task
trigger: /alcatraz-commit
---

# Alcatraz Atomic Commits

Commit once per completed task — not per file, not per session, not mid-task.

## The rule

**One task = one commit.** A task is done when:
- The feature/fix works end to end (manually verified)
- TypeScript compiles with no errors (`npx tsc --noEmit` in the affected app)
- Lint passes (`npm run lint` in the affected app)

Do not commit work-in-progress. If a task isn't done, don't commit.

## Before committing

```bash
# In the affected app(s)
npx tsc --noEmit
npm run lint

# Stage only files related to the task
git diff --stat          # see what changed
git add apps/api/...     # stage specific files, never git add .
```

**Never stage:**
- `.env.local` files
- `node_modules/`
- `.next/` build output

## Commit message format ( conventional commits )

```
<type>(<scope>): <what changed and why>
```

**Type** — pick one:
- `feat` — new feature
- `fix` — bug fix
- `chore` — tooling, deps, config with no behavior change
- `refactor` — restructure without changing behavior
- `docs` — documentation only
- `style` — formatting, no logic change
- `test` — adding or fixing tests

**Scope** = the part of the system changed:
- `api/log` — POST /api/log route
- `api/scan` — POST /api/scan route  
- `web/dashboard` — dashboard UI
- `web/realtime` — Supabase Realtime subscription
- `db` — schema or types change
- `alcatraz-py` — Python package
- `demo` — demo agents
- `config` — env, Next.js, Tailwind, tsconfig
- `docs` — CLAUDE.md, README, project.md

**Examples:**
```
feat(api/log): add CORS headers for web app requests
feat(web/dashboard): show live BLOCKED/ALLOWED feed via Supabase Realtime
feat(api/scan): store generated rules in scans table after Claude response
chore(db): add severity index on logs table
feat(alcatraz-py): monkey patch Anthropic SDK in core.py
style(web/dashboard): color BLOCKED rows red, ALLOWED rows green
```

## Multi-app tasks

If a task touches both `apps/api` and `apps/web` (e.g. adding a new endpoint + wiring it to the dashboard), commit them together in one commit — they're one logical unit.

```bash
git add apps/api/app/api/log/route.ts apps/web/app/page.tsx
git commit -m "feat(api/log,web/dashboard): wire real-time log feed end to end"
```

## Scope of staged files

Stage exactly what the task required. If you changed `apps/web/app/page.tsx` for debugging and it's unrelated to the task, reset it:

```bash
git checkout apps/web/app/page.tsx
```

## After committing

Verify with `git log --oneline -5` that the commit message is clear and the scope is right. If the message is wrong, fix it immediately with `git commit --amend` (before pushing).
