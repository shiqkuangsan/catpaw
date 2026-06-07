#!/usr/bin/env bash
# provider-session.sh - optional tmux-backed observable provider sessions.
#
# Usage:
#   provider-session.sh check  <provider>
#   provider-session.sh open   <provider> [cwd]
#   provider-session.sh send   <provider> <message>
#   provider-session.sh read   <provider> [lines]
#   provider-session.sh wait   <provider> [timeout]
#   provider-session.sh status <provider>
#   provider-session.sh close  <provider>
#
# Providers: claude/cc, codex/cx, gemini, opencode/oc.

set -euo pipefail

provider_key() {
  case "$1" in
    claude|cc) echo "claude" ;;
    codex|cx) echo "codex" ;;
    gemini) echo "gemini" ;;
    opencode|oc) echo "opencode" ;;
    *) echo "ERR: unknown provider '$1'" >&2; exit 1 ;;
  esac
}

provider_cmd() {
  case "$1" in
    claude) echo "claude" ;;
    codex) echo "codex" ;;
    gemini) echo "gemini" ;;
    opencode) echo "opencode" ;;
    *) echo "ERR: unknown provider '$1'" >&2; exit 1 ;;
  esac
}

session_name() {
  echo "catpaw-provider-$1"
}

require_tmux() {
  if ! command -v tmux >/dev/null 2>&1; then
    echo "ERR: tmux is required for observable provider sessions." >&2
    exit 1
  fi
}

cmd_check() {
  local provider=$1
  local command
  command=$(provider_cmd "$provider")

  echo "PROVIDER $provider"
  if command -v "$command" >/dev/null 2>&1; then
    echo "CLI available $command"
  else
    echo "CLI missing $command"
  fi

  if command -v tmux >/dev/null 2>&1; then
    echo "TMUX available tmux"
  else
    echo "TMUX missing tmux"
  fi

  if command -v "$command" >/dev/null 2>&1 && command -v tmux >/dev/null 2>&1; then
    echo "OBSERVABLE available"
    echo "FALLBACK none"
  elif command -v "$command" >/dev/null 2>&1; then
    echo "OBSERVABLE unavailable"
    echo "FALLBACK non-interactive-cli"
  else
    echo "OBSERVABLE unavailable"
    echo "FALLBACK current-tool-subagent-or-inline-gap"
  fi
}

cmd_open() {
  local provider=$1
  local cwd=${2:-$(pwd)}
  local session
  session=$(session_name "$provider")

  require_tmux
  if tmux has-session -t "$session" 2>/dev/null; then
    echo "SESSION_EXISTS $session"
    return 0
  fi

  local command
  command=$(provider_cmd "$provider")
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERR: provider command not found: $command" >&2
    exit 1
  fi

  tmux new-session -d -s "$session" -x 200 -y 50 -c "$cwd" "$command"
  echo "OPENED $session"
}

cmd_send() {
  local provider=$1
  shift
  local message="$*"
  local session
  session=$(session_name "$provider")

  require_tmux
  if ! tmux has-session -t "$session" 2>/dev/null; then
    echo "ERR: no session for $provider. Run 'provider-session.sh open $provider' first." >&2
    exit 1
  fi

  local tmpfile
  tmpfile=$(mktemp /tmp/catpaw-provider-message-XXXXXX)
  printf '%s' "$message" > "$tmpfile"
  tmux load-buffer "$tmpfile"
  tmux paste-buffer -p -t "$session"
  rm -f "$tmpfile"

  sleep 0.5
  tmux send-keys -t "$session" Enter
  sleep 0.5
  tmux send-keys -t "$session" Enter

  cmd_wait "$provider"
}

cmd_read() {
  local provider=$1
  local lines=${2:-200}
  local session
  session=$(session_name "$provider")

  require_tmux
  tmux capture-pane -t "$session" -p -S "-$lines" 2>/dev/null |
    sed 's/[^[:print:][:space:]]//g'
}

cmd_wait() {
  local provider=$1
  local timeout=${2:-600}
  local session
  session=$(session_name "$provider")

  require_tmux
  if ! tmux has-session -t "$session" 2>/dev/null; then
    echo "CLOSED"
    return 1
  fi

  local previous=""
  local stable_count=0
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    local capture
    capture=$(tmux capture-pane -t "$session" -p -S -500 2>/dev/null || true)
    if [ "$capture" = "$previous" ] && [ -n "$capture" ]; then
      stable_count=$((stable_count + 1))
      if [ "$stable_count" -ge 2 ]; then
        echo "STABLE"
        return 0
      fi
    else
      stable_count=0
    fi
    previous="$capture"
    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo "TIMEOUT"
}

cmd_status() {
  local provider=$1
  local session
  session=$(session_name "$provider")

  require_tmux
  if tmux has-session -t "$session" 2>/dev/null; then
    echo "OPEN $session"
  else
    echo "CLOSED $session"
  fi
}

cmd_close() {
  local provider=$1
  local session
  session=$(session_name "$provider")

  require_tmux
  tmux kill-session -t "$session" 2>/dev/null && echo "CLOSED $session" || echo "NOT_FOUND $session"
}

if [ $# -lt 2 ]; then
  echo "Usage: provider-session.sh <check|open|send|read|wait|status|close> <provider> [args...]"
  exit 1
fi

command=$1
provider=$(provider_key "$2")
shift 2

case "$command" in
  check) cmd_check "$provider" "$@" ;;
  open) cmd_open "$provider" "$@" ;;
  send) cmd_send "$provider" "$@" ;;
  read) cmd_read "$provider" "$@" ;;
  wait) cmd_wait "$provider" "$@" ;;
  status) cmd_status "$provider" ;;
  close) cmd_close "$provider" ;;
  *) echo "ERR: unknown command '$command'" >&2; exit 1 ;;
esac
