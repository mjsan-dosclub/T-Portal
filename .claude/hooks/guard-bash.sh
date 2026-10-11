#!/usr/bin/env bash
# PreToolUse hook (Bash): blocks destructive / out-of-policy commands before they run.
# Exit 2 = block; stderr is shown to Claude so it can ask the PM instead.
input="$(cat)"
cmd="$(printf '%s' "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command??"")}catch{}})')"

block() { echo "BLOCKED by CLAUDE.md §5: $1. Ask the PM in chat for explicit approval." >&2; exit 2; }

case "$cmd" in
  *"rm -rf"*|*"rm -fr"*)                     block "recursive delete" ;;
  *"migrate reset"*|*"db push --force-reset"*|*"--accept-data-loss"*) block "destructive Prisma command" ;;
  *"DROP TABLE"*|*"DROP DATABASE"*|*"TRUNCATE"*|*"drop table"*|*"truncate "*) block "destructive SQL" ;;
  *"push --force"*|*"push -f"*|*"reset --hard"*|*"branch -D"*|*"filter-branch"*) block "history-rewriting git command" ;;
  *"--no-verify"*)                           block "skipping git hooks" ;;
  *"curl "*"| sh"*|*"curl "*"| bash"*|*"wget "*"| sh"*) block "piping remote script to shell" ;;
esac

# Never run DB-mutating commands against a non-local database.
if printf '%s' "$cmd" | grep -Eq 'prisma (migrate|db seed|db push)|npm run (db:|seed)'; then
  url="${DATABASE_URL:-}"
  if [ -f .env.local ] && [ -z "$url" ]; then url="$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2-)"; fi
  if [ -n "$url" ] && ! printf '%s' "$url" | grep -Eq '@(localhost|127\.0\.0\.1|db|postgres)(:|/)'; then
    block "DATABASE_URL is not local"
  fi
fi
exit 0
