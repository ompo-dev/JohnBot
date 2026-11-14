# CI, publication and manual deployment

`.github/workflows/infrastructure.yml` runs on pull requests, pushes and manual dispatches.
Bun is pinned to 1.4.4, dependencies use `bun install --frozen-lockfile`.
Checks cover Biome lint/format, real isolated Husky commits, style regression and
Tailwind equivalence, DOM/application/URL tests, static Next build, Compose validation,
and a Docker build loaded into the runner daemon followed by non-root/health/HTTP smoke checks.
Legacy lint warnings remain visible. `ignoreBuildErrors` remains enabled: this is not a full typecheck.

Publication rebuilds and smoke-tests the actual tagged image before registry login or push, using the same `.github/scripts/smoke-image.sh` as verification. Its exit trap removes the test container on success or failure. Publication requires successful verification and a push to the repository default branch
or a `v*` tag. The publish job additionally requires the revision to be an ancestor of the
default branch. PRs and manual dispatches cannot enter the publish job. It alone gets
`packages: write` and uses the ephemeral `GITHUB_TOKEN`; there are no custom secrets,
deploy credentials, remote host placeholders or secrets passed to image builds.
Protect the default branch and `v*` tags with repository rulesets and restrict Actions
workflow edits. A tag on a commit outside the default branch is rejected.
Images use `ghcr.io/<lowercase github.repository>:sha-<full commit>`; default-branch
pushes also update `latest`, and release tags publish their exact tag. No remote exists
locally, so no workflow, publication or deployment has run in this work.

Action pins were resolved with `git ls-remote` on 2026-11-11:
- actions/checkout v4.2.2: `11bd71901bbe5b1630ceea73d27597364c9af683`.
- oven-sh/setup-bun v2: `0c5077e51419868618aeaa5fe8019c62421857d6`.

Primary references: [setup-bun](https://github.com/oven-sh/setup-bun),
[GitHub publishing guidance](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images),
[GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Manual deployment

1. Provision your own Docker host and TLS reverse proxy. Configure its DNS and firewall.
2. Choose the verified image's immutable digest in GHCR. For private packages, authenticate
   on that host using a read-only package credential via `docker login --password-stdin`.
3. Pull and run, replacing the example reference with that actual digest:

   ```sh
   docker pull ghcr.io/OWNER/REPOSITORY@sha256:DIGEST
   docker run -d --name johnbot --restart unless-stopped --init \
     --security-opt no-new-privileges:true --cap-drop ALL \
     -p 127.0.0.1:3000:3000 ghcr.io/OWNER/REPOSITORY@sha256:DIGEST
   docker inspect johnbot --format '{{.State.Health.Status}}'
   curl --fail http://127.0.0.1:3000/
   docker logs johnbot
   ```

4. Route HTTPS to loopback port 3000 only after health and page checks pass.
5. For upgrades, retain the previous digest; smoke-test the new image on another loopback
   port, then switch the proxy. Roll back by restarting the previous digest and switching back.

The current app remains a mock UI. Runtime environment variables do not rewrite already
compiled `NEXT_PUBLIC_*` values. Review public build-time configuration before building.
Docker daemon was stopped locally; container runtime success is left to CI or the operator.

## Husky

`prepare` installs Husky only when Git and a repository are available; `HUSKY=0` disables
installation in CI. Docker deps explicitly copies `scripts/setup-husky.mjs` before frozen
installation, so lifecycle setup cannot reference a missing file. Outside Git it skips safely.
The hook copies supported staged blobs to a temporary tree and lints without writing fixes.
No working-tree changes or restaging occur. `node .husky/test-hooks.mjs` proves rejection
of invalid staged syntax and acceptance of a clean index with invalid unstaged content.


Node is pinned to 24.19.0 using actions/setup-node v4.4.0, verified via `git ls-remote`:
`49933ea5288caeca8642d1e84afbd3f7d6820020`.

