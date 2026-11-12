#!/usr/bin/env bash
# Production deploy of the committed HEAD to the existing Vercel project (docs/DEPLOY.md).
# Vercel rejects CLI deploys from a git checkout whose commit author isn't a member of the Vercel team, so the site is
# deployed from a clean export WITHOUT .git: `git archive HEAD` into a temporary folder outside the repo, plus the
# project link (.vercel/project.json: project + org ids, no secrets). The folder is deleted afterwards, also on errors.
# No tokens or env values here: run `npx vercel@latest login` and `npx vercel@latest link` once beforehand.
#
#   scripts/deploy-vercel.sh            # deploy HEAD to production, then check /, /mint, /api/chat
#   scripts/deploy-vercel.sh --dry-run  # export + list what would be uploaded, no deploy
#
# Two projects, one build each (one build = one chain, task 080; env values live in each Vercel project, not here):
#   mainnet (default): project neargochi, link .vercel/project.json
#   demo / testnet:    VERCEL_PROJECT=neargochi-demo VERCEL_LINK=.vercel-demo/project.json scripts/deploy-vercel.sh
set -euo pipefail

PROJECT="${VERCEL_PROJECT:-neargochi}"
LINK="${VERCEL_LINK:-.vercel/project.json}"
SITE="${SITE:-https://$PROJECT.vercel.app}"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

[ -f "$LINK" ] || { echo "no $LINK: link the project '$PROJECT' first (docs/DEPLOY.md)"; exit 1; }
grep -q "\"projectName\": *\"$PROJECT\"" "$LINK" || { echo "$LINK is not linked to the project '$PROJECT'"; exit 1; }
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "uncommitted changes: the deploy is HEAD ($(git rev-parse --short HEAD)), commit them first"; git status --short --untracked-files=no; exit 1
fi

TMPBASE="${TMPDIR:-/tmp}"
DIR="$(mktemp -d "${TMPBASE%/}/neargochi-deploy.XXXXXX")"
cleanup() { rm -rf "$DIR"; echo "removed $DIR"; }
trap cleanup EXIT

git archive HEAD | tar -x -C "$DIR"
mkdir -p "$DIR/.vercel"
cp "$LINK" "$DIR/.vercel/project.json"   # only the link; never .vercel/.env* or the repo's .env.local
echo "project $PROJECT ($SITE)"
echo "exported $(git rev-parse --short HEAD) to $DIR ($(du -sh "$DIR" | cut -f1)); .git: $([ -e "$DIR/.git" ] && echo present || echo none)"
# .env.example (tracked template, no values) is fine; any real env file means something is committed that shouldn't be
ENVS="$(ls -A "$DIR" | grep -E '^\.env' | grep -v '^\.env\.example$' || true)"
if [ -n "$ENVS" ]; then echo "env file(s) in the export, refusing: $ENVS"; exit 1; fi

if [ "$DRY" = 1 ]; then
  echo "dry run: top level of the export (.vercelignore then drops env files, docs/, scripts/, contracts/, … from the upload):"
  ls -A "$DIR"
  exit 0
fi

(cd "$DIR" && npx --yes vercel@latest deploy --prod)

echo "checks:"
for path in / /mint; do
  printf '  %-6s %s\n' "$path" "$(curl -s -o /dev/null -w '%{http_code}' "$SITE$path")"
done
printf '  %-6s %s\n' "/api/chat" "$(curl -s "$SITE/api/chat")"
