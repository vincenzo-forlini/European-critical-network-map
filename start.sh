#!/bin/sh
# Starts the map locally and opens it in your browser.
# Leave this running while you use the map.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js is not installed, or not on your PATH."
  echo "  Install it from https://nodejs.org and run this again."
  echo
  exit 1
fi
exec node scripts/serve.mjs
