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

## Two projects: mainnet + free demo (task 080)

One build = one chain (`NEXT_PUBLIC_*` are baked in at build time), so the real-money site and the free "try it" site are
two Vercel projects built from the same commit of `main`:

| project | URL | purpose | Production env (names = values) |
|---|---|---|---|
| `neargochi` (existing) | https://neargochi.vercel.app | the launch: real NEAR | `NEXT_PUBLIC_CHAIN=mainnet`, `NEXT_PUBLIC_DROP1_CONTRACT=drop1.neargochi-dev.near`, `NEXT_PUBLIC_TREASURY=neargotchiai.near`, `NEAR_AI_API_KEY` (server only), **energy ledger (task 081): Upstash Redis vars (from the integration), `SESSION_SECRET`, optional `DAILY_CHAT_CAP`** — see below; optional `NEXT_PUBLIC_RPC_URL`, `NEAR_AI_MODEL` |
| `neargochi-demo` (new) | https://neargochi-demo.vercel.app | judges, wallet-free | `NEXT_PUBLIC_CHAIN=demo` + optionally `NEAR_AI_API_KEY` (a separate key only for the demo, so it can be revoked without touching mainnet). The testnet build (`NEXT_PUBLIC_CHAIN=testnet`, `NEXT_PUBLIC_DROP1_CONTRACT=neargotchi-drop1-ng67.testnet`, `NEXT_PUBLIC_TREASURY=neargotchi-team-ng67.testnet`) is a local option, see the README |

A mainnet build refuses to sign if the contract or treasury is missing or ends in `.testnet` (`lib/chain.ts` CONFIG_ERROR).

Once (owner, not from the repo folder — `vercel link` would overwrite `.vercel/project.json`):
```sh
npx vercel@latest login
mkdir -p ~/neargochi-demo-link && cd ~/neargochi-demo-link
npx vercel@latest project add neargochi-demo
npx vercel@latest link --yes --project neargochi-demo
npx vercel@latest env add NEXT_PUBLIC_CHAIN production                 # demo
npx vercel@latest env add NEXT_PUBLIC_DROP1_CONTRACT production        # neargotchi-drop1-ng67.testnet  (local testnet build only, skip for the hosted demo)
npx vercel@latest env add NEXT_PUBLIC_TREASURY production              # neargotchi-team-ng67.testnet   (local testnet build only, skip for the hosted demo)
npx vercel@latest env add NEAR_AI_API_KEY production                   # optional, typed at the prompt, never in a file
mkdir -p ~/Desktop/neargochi/.vercel-demo && cp .vercel/project.json ~/Desktop/neargochi/.vercel-demo/project.json
```
`.vercel-demo/` is gitignored. Check the mainnet project's variables with `npx vercel@latest env ls` from the repo folder.

Deploy (from the repo folder, committed `main`):
```sh
scripts/deploy-vercel.sh                                                                         # mainnet: neargochi
VERCEL_PROJECT=neargochi-demo VERCEL_LINK=.vercel-demo/project.json scripts/deploy-vercel.sh   # demo: neargochi-demo
```
Each run checks `/`, `/mint` and `/api/chat` on that project's URL. Add `--dry-run` to see the export without deploying.

## Energy ledger on mainnet: Upstash Redis + session secret (task 081)

The mainnet build keeps energy (= NEAR AI credits) on the server (`docs/ENERGY.md`). **Without these variables the
mainnet chat and energy packs answer 503 (fail closed)**; the rest of the site works. Only the `neargochi` project needs
them; the demo project doesn't.

| variable | where it comes from | notes |
|---|---|---|
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` **or** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | set by the Upstash integration | the code reads either pair; server only, never `NEXT_PUBLIC_` |
| `SESSION_SECRET` | you: a random string ≥ 32 characters | signs the 24 h session cookie; changing it signs everyone out |
| `DAILY_CHAT_CAP` | you, optional | NEAR AI calls per UTC day for the whole site; default 300 |

Steps (owner, Vercel dashboard):
1. Vercel → **Storage** (or Marketplace) → **Upstash** → *Redis* → Create database: plan **Free**, region close to the
   functions (e.g. Frankfurt `fra1` if the project runs in Europe; the project's region is under Settings → Functions).
2. On the database page → **Connect Project** → choose **neargochi** → environments: **Production** (and Preview if you
   test there) → Connect. This adds the URL / token variables to the project.
3. Check which names arrived (the integration has used both namings):
   ```sh
   npx vercel@latest env ls          # in the repo folder (linked to neargochi): look for KV_REST_API_* or UPSTASH_REDIS_REST_*
   ```
4. Add the session secret (typed at the prompt, never in a file or chat):
   ```sh
   openssl rand -base64 48 | tr -d '\n' | pbcopy      # copies a random secret to the clipboard
   npx vercel@latest env add SESSION_SECRET production # paste at the prompt
   npx vercel@latest env add DAILY_CHAT_CAP production # optional, e.g. 300
   ```
5. Deploy (`scripts/deploy-vercel.sh`). Check: `/api/chat` → `{"enabled":true,"ledger":true}`;
   `/api/auth/nonce` → 200 with a nonce (503 `store_unavailable` = Redis vars missing, 503 `not_configured` = secret
   missing). Then on /pet: connect → **sign in with wallet** → the energy bar shows the server balance; send one
   message (−4); buy one pack (+50 after "confirming payment…"). Try once with MyNearWallet and once with Meteor.

Local runs need none of this: without Redis vars and outside Vercel the ledger uses memory and a per-process secret.

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

## Publishing the repo (task 085)

The public repo is the `neargotchi` remote. Push **only** the `main` branch, by name:

```bash
git log main --format='%an %ae' | sort | uniq -c   # must list only neargotchi <neargotchi@users.noreply.github.com>
git push neargotchi main
```

Never `git push --all`, `--mirror` or `--tags` (and never push another branch) without checking it first: the local
repo still holds refs with the old personal e-mail in their history (the local branch `dark-mode-020` and
`origin/main`, the old private repo, whose push URL is disabled). Those refs stay local; history is not rewritten. If
the author check above shows anything other than `neargotchi`, stop and do not push.
