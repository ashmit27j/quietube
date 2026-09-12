# Carrying this project's context into Claude Code

## The short answer

**Claude Code cannot read this chat, this Project, or any claude.ai
conversation history.** It is a local CLI. Its context is: files on disk,
`CLAUDE.md` files it finds, `.claude/` config in the repo and in `~/.claude/`,
and its own local session transcripts in `~/.claude/projects/`. There is no
connection to claude.ai Projects — it is an open feature request
([anthropics/claude-code#55787](https://github.com/anthropics/claude-code/issues/55787)),
not a setting you can turn on.

So the context does not travel by being *linked*. It travels by being
**written down in the repo**, which is what this repo is.

## What carries context here, and what reads it

| File | Read by Claude Code | Purpose |
|---|---|---|
| `CLAUDE.md` | automatically, every session, always | the rules. Kept short on purpose — it is in context on every single turn, so length costs you. |
| `docs/SPEC.md` | when asked, or when `CLAUDE.md` points at it | what we are building and why |
| `docs/DECISIONS.md` | when asked | why the code is shaped this way; stops the next session re-litigating settled choices |
| `docs/ARCHITECTURE.md` | when asked | how the pieces fit |
| `.claude/skills/*/SKILL.md` | loaded on demand when the description matches | deep procedural knowledge (selector auditing, MV3 gotchas, store submission) |
| `.claude/commands/*.md` | when you type `/add-toggle` etc. | repeatable multi-step jobs |

The split matters. `CLAUDE.md` is always-on context, so it holds only rules and
pointers. The skills hold the long procedural detail and load only when
relevant, so they can be as detailed as you like without taxing every turn.

## Getting started locally

```bash
git init && git add -A && git commit -m "Initial scaffold"
claude
```

Then, first session:

```
Read CLAUDE.md and docs/SPEC.md, then work through docs/ROADMAP.md v0.2.
Start with /audit-selectors.
```

Claude Code picks up `CLAUDE.md`, `.claude/skills/` and `.claude/commands/`
from the repo root with no configuration.

## Keeping context across Claude Code sessions

Claude Code sessions are also independent by default. Three mechanisms:

- `claude --continue` resumes the last session in that directory;
  `claude --resume` lets you pick one. Same-machine only.
- `/memory` edits `CLAUDE.md` (project) or `~/.claude/CLAUDE.md` (all your
  projects) from inside a session. Use it to promote something you had to
  explain twice.
- **The commit log.** For this project, treat a decision as not made until it
  is in `docs/DECISIONS.md`. That file is the actual memory.

## Keeping this chat and Claude Code in sync

They do not sync, so pick one direction and stick to it:

- **Claude Code is the source of truth for code.** Anything decided here that
  affects implementation goes into a repo file before you leave this chat.
- **This Project is the source of truth for product thinking** — positioning,
  store strategy, competitor moves. The project docs written from this session
  hold that, and any claude.ai chat in this Project can read them.

When you want something from one side on the other, move the file: paste repo
docs into the Project, or copy Project docs into `docs/`. There is no
automatic path in either direction.
