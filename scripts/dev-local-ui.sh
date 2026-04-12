#!/usr/bin/env bash

set -euo pipefail

cd ui
export VITE_COFFEE_PROXY_TARGET="${VITE_COFFEE_PROXY_TARGET:-http://api.coffee.localhost:1365}"

exec bun run dev -- --host "${HOST:-127.0.0.1}" --port "${PORT:-5173}"
