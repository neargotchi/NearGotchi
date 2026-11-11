# Deploy (Vercel CLI, no Git integration)

The site is the existing Vercel project **neargochi** (https://neargochi.vercel.app). It is deployed from this folder
with the Vercel CLI; the project is not connected to the GitHub repo (and must not be: the Vercel account's Git
connection belongs to another GitHub account). The build runs on Vercel with the project's own environment variables.

## Once per machine

```sh
npx vercel@latest login                 # interactive, in the browser; no token is pasted anywhere
npx vercel@latest link                  # pick your scope, then "Link to existing project?" → yes → neargochi
```
`link` writes `.vercel/project.json` (project + team ids). `.vercel/` is gitignored: it never goes into the repo.

## Every deploy

Vercel refuses CLI deploys from this git checkout: the commit author (`neargotchi`) is not a member of the Vercel team.
So the site is deployed from a clean export **without `.git`**, made by a script:
```sh
git status                              # commit first: the deploy is HEAD, the script refuses uncommitted changes
scripts/deploy-vercel.sh --dry-run      # optional: export + list, nothing is sent
scripts/deploy-vercel.sh                # export HEAD → temp folder, copy .vercel/project.json, `vercel deploy --prod`, checks
```
What it does: `git archive HEAD | tar -x` into a new temporary folder outside the repo (only committed files: no `.git`,
no `.env.local`, no `images/` / `ipfs/`), copies **only** `.vercel/project.json` (project + org ids, no secrets), refuses
if any real env file is in the export, runs `npx vercel@latest deploy --prod` there (the build runs on Vercel with the
project's own variables), deletes the folder on exit (also after an error), then prints the checks:
`/` → 200, `/mint` → 200, `/api/chat` → `{"enabled":true}`. The script holds no tokens or env values.
`.vercelignore` additionally keeps `docs/`, `scripts/`, `contracts/`, `assets-raw/` and any env file out of the upload.
Preview instead of production: run the same steps by hand with `npx vercel@latest deploy` (no `--prod`).

## Environment variables

Set in Vercel → Project → Settings → Environment Variables (names only here): `NEXT_PUBLIC_CHAIN`,
`NEXT_PUBLIC_DROP1_CONTRACT`, `NEXT_PUBLIC_TREASURY`, `NEAR_AI_API_KEY` (server only, never `NEXT_PUBLIC_`), optional
`NEXT_PUBLIC_RPC_URL`, `NEAR_AI_MODEL`. `NEXT_PUBLIC_*` values are baked into the JavaScript at build time: **after
changing any variable, deploy again** (`scripts/deploy-vercel.sh`, or Deployments → ⋯ → Redeploy). List them with
`npx vercel@latest env ls`.

## When something fails

- "Git author … must have access to the team": you ran `vercel deploy` inside the git checkout — use
  `scripts/deploy-vercel.sh` (it deploys from an export without `.git`).
- Build error: the CLI prints the Vercel build log URL; reproduce locally with `npm run build` (same env: set the
  variables in `.env.local`, which is never uploaded).
- Wrong project / scope: `cat .vercel/project.json`, or delete `.vercel/` and run `link` again.
- Bad release: Vercel → Deployments → pick the previous production deployment → ⋯ → Promote to Production (or
  `npx vercel@latest rollback`). Nothing in the repo has to change.
- `{"enabled":false}` from /api/chat: `NEAR_AI_API_KEY` is missing in Production → add it and redeploy.

## Old Git integration (manual, owner)

The project still has the old GitHub repo connected (it auto-deployed pushes from there). After the first CLI deploy
works: Vercel → Project → Settings → Git → **Disconnect**. Do not use "Switch Git Provider" and do not change the
account's GitHub login connection. Disconnecting only stops automatic deploys; existing deployments and environment
variables stay.
