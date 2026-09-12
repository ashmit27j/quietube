# Pushing this to github.com/ashmit27j/quietube

The cloud session that built this could not reach your repository — its GitHub
access is granted per-repository and `quietube` was not attached to it — so the
first push has to come from your machine. One time, then it is a normal repo.

The git history is already here: one commit, 53 files, authored as you.

```bash
unzip quiettube.zip
cd quiettube

# If the repo is empty on GitHub:
git remote add origin https://github.com/ashmit27j/quietube.git
git branch -M main
git push -u origin main

# If it already has commits you want to keep:
git remote add origin https://github.com/ashmit27j/quietube.git
git fetch origin
git rebase origin/main      # or: git pull --rebase origin main
git push -u origin main
```

Then confirm it is private: repo → Settings → General → Danger Zone → Change
visibility. Flip it public before the store listing goes up (`docs/ROADMAP.md`
v1.0) — the open-source claim is part of the privacy pitch.

## Then, immediately

```bash
npm install
npm run test        # 60 offline tests, no network needed
claude
```

First prompt to Claude Code:

> Read CLAUDE.md and docs/SPEC.md, then work through docs/ROADMAP.md v0.2.
> Start with /audit-selectors — the selectors have never been checked against
> live YouTube.

That is the single highest-value remaining task, and it needs a machine that
can actually load youtube.com.
