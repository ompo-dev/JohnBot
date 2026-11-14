#!/usr/bin/env bash
set -eu
image=${1:?image argument required}
trap 'docker logs johnbot-ci 2>/dev/null || true; docker rm --force johnbot-ci 2>/dev/null || true' EXIT


test "$(docker image inspect "$image" --format '{{.Config.User}}')" = nextjs
docker run --detach --name johnbot-ci --publish 127.0.0.1:3000:3000 "$image"
for attempt in $(seq 1 60); do
  status=$(docker inspect johnbot-ci --format '{{.State.Health.Status}}')
  if [ "$status" = healthy ]; then
    curl --fail --silent http://127.0.0.1:3000/ > /dev/null
    exit 0
  fi
  if [ "$status" = unhealthy ]; then break; fi
  sleep 2
done
docker logs johnbot-ci
exit 1
