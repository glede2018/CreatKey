#!/bin/sh

set -eu

# Resolve the active Docker context before using an isolated config. This keeps
# Colima/Rancher Desktop/Docker Desktop sockets portable across machines.
if [ -z "${DOCKER_HOST:-}" ]; then
  ACTIVE_DOCKER_HOST=$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)
  if [ -n "$ACTIVE_DOCKER_HOST" ]; then
    export DOCKER_HOST="$ACTIVE_DOCKER_HOST"
  fi
fi

if [ -z "${DOCKER_HOST:-}" ]; then
  echo "无法确定 Docker 服务地址，请先启动 Colima 或 Docker Desktop。" >&2
  exit 1
fi

# The local Docker config may reference a removed desktop credential helper.
# Compose only needs public base images here, so use a clean, temporary config
# without changing the user's global ~/.docker/config.json.
TEMP_DOCKER_CONFIG=$(mktemp -d "${TMPDIR:-/tmp}/creatkey-docker.XXXXXX")
cleanup() {
  rm -rf "$TEMP_DOCKER_CONFIG"
}
trap cleanup EXIT INT TERM
printf '{}\n' > "$TEMP_DOCKER_CONFIG/config.json"
export DOCKER_CONFIG="$TEMP_DOCKER_CONFIG"

# Compose v5 otherwise requires the optional buildx plugin. The classic builder
# is sufficient for these Dockerfiles and works consistently with Colima.
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

if command -v docker-compose >/dev/null 2>&1; then
  docker-compose "$@"
elif docker compose version >/dev/null 2>&1; then
  docker compose "$@"
else
  echo "未找到 Docker Compose，请安装 docker-compose 或 Docker Compose 插件。" >&2
  exit 1
fi
