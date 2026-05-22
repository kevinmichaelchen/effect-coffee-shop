#!/usr/bin/env bash
set -euo pipefail

container_name="effect-coffee-postgres-test"
database_name="effect_coffee_drizzle_test"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker or OrbStack is required for the local Postgres contract tests." >&2
  exit 1
fi

cleanup() {
  docker rm -f "${container_name}" >/dev/null 2>&1 || true
}

cleanup
trap cleanup EXIT

docker run \
  --rm \
  -d \
  --name "${container_name}" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB="${database_name}" \
  -p 127.0.0.1::5432 \
  postgres:16-alpine >/dev/null

for _ in {1..30}; do
  if docker exec "${container_name}" pg_isready -U postgres -d "${database_name}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "${container_name}" pg_isready -U postgres -d "${database_name}" >/dev/null 2>&1; then
  docker logs "${container_name}" >&2
  exit 1
fi

postgres_port="$(docker port "${container_name}" 5432/tcp | sed 's/.*://')"
postgres_url="postgres://postgres:postgres@127.0.0.1:${postgres_port}/${database_name}"

bunx turbo run typecheck lint fmt:check test --force
COFFEE_POSTGRES_TEST_URL="${postgres_url}" bun run --cwd packages/coffee/external/drizzle-postgres test
bun run lint:custom
bun run fallow
