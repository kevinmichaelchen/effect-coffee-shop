#!/usr/bin/env bash

set -euo pipefail

exec bun run --cwd backend dev:onion:api
