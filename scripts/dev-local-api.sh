#!/usr/bin/env bash

set -euo pipefail

exec bun run --cwd apps/backend dev:local:api
