#!/usr/bin/env bash
# Install flexac + /flexac for the current user (macOS / zsh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_BIN="${HOME}/.local/bin"
ZSHENV="${HOME}/.zshenv"

mkdir -p "$LOCAL_BIN"
ln -sfn "$ROOT/bin/flexac" "$LOCAL_BIN/flexac"
chmod +x "$ROOT/bin/flexac"

MARKER="# flex-auto-counter flexac"
if [[ -f "$ZSHENV" ]] && grep -qF "$MARKER" "$ZSHENV"; then
  echo "Shell functions already present in $ZSHENV"
else
  cat >> "$ZSHENV" <<EOF

$MARKER
function flexac() {
  "\$HOME/.local/bin/flexac" "\$@"
}
function '/flexac'() {
  "\$HOME/.local/bin/flexac" "\$@"
}
EOF
  echo "Added flexac and /flexac to $ZSHENV"
fi

echo "Done. Open a new terminal tab, then try: /flexac --help"
