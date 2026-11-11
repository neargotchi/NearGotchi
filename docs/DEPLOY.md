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

```sh
git status                              # commit first: the deploy is whatever is in this folder right now
npx vercel@latest deploy --prod         # uploads the folder (minus .vercelignore), builds on Vercel, promotes to neargochi.vercel.app
curl -s -o /dev/null -w "%{http_code}\n" https://neargochi.vercel.app/         # 200
curl -s -o /dev/null -w "%{http_code}\n" https://neargochi.vercel.app/mint     # 200
curl -s https://neargochi.vercel.app/api/chat                                  # {"enabled":true}
```
`.vercelignore` keeps local env files (`.env.local` would override the production variables and leak the AI key into the
uploaded source), the 148 MB PNGs, `ipfs/`, `contracts/`, `docs/` and `scripts/` out of the upload. Preview first:
`npx vercel@latest deploy` (no `--prod`) gives a unique preview URL with the Preview variables.

## Environment variables

Set in Vercel → Project → Settings → Environment Variables (names only here): `NEXT_PUBLIC_CHAIN`,
`NEXT_PUBLIC_DROP1_CONTRACT`, `NEXT_PUBLIC_TREASURY`, `NEAR_AI_API_KEY` (server only, never `NEXT_PUBLIC_`), optional
`NEXT_PUBLIC_RPC_URL`, `NEAR_AI_MODEL`. `NEXT_PUBLIC_*` values are baked into the JavaScript at build time: **after
changing any variable, deploy again** (`npx vercel@latest deploy --prod`, or Deployments → ⋯ → Redeploy). List them with
`npx vercel@latest env ls`.

## When something fails

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
