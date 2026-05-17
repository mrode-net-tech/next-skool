# Day 109 — Build + deploy job

## Goal
Add a CI job that builds the Docker image, pushes it to a container registry, and triggers a deployment. After this day, every merge to `main` automatically ships a new image — the full CD pipeline is in place.

## Estimated time
~2 hours

## Prerequisites
Day 108 (test job passing). Day 103 (multi-stage Dockerfile). A Fly.io or Railway account (you will deploy to whichever you chose in Day 78).

## Where to put your code
In `ai-folio`, inside `.github/workflows/`.

## Explanation

**The CD pipeline** runs after CI passes: build image → push to registry → deploy. The registry acts as an intermediary: CI builds and tags the image, the hosting platform pulls and runs it. Docker Hub, GitHub Container Registry (GHCR), and Fly.io's built-in registry are all options. GHCR is convenient for GitHub-hosted projects because authentication uses the built-in `GITHUB_TOKEN` — no extra credentials.

**`needs:`** makes a job depend on other jobs completing successfully. The deploy job only runs if `lint`, `typecheck`, and `test` all pass — failed tests cannot ship. This is the fundamental safety property of a CD pipeline.

**Fly.io deployment** works by running `flyctl deploy` with a pre-built image. Fly pulls the image, creates a new machine, runs health checks, and switches traffic. If health checks fail, the old machine stays running. In Laravel terms, this is a zero-downtime deploy with automatic rollback — Forge/Envoyer's most important feature.

## Step-by-step

### 1. Add GitHub Container Registry credentials

No manual setup needed: GitHub Actions automatically provides `GITHUB_TOKEN` with write access to GHCR for the repository. Reference it as `${{ secrets.GITHUB_TOKEN }}`.

Your image will be published at: `ghcr.io/<owner>/<repo>:latest`

### 2. Add a deploy job to ci.yml

```yaml name=.github/workflows/ci.yml
  deploy:
    name: Build + Deploy
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]

    # Only deploy from main branch, not from PRs
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    permissions:
      contents: read
      packages: write     # needed to push to GHCR

    env:
      REGISTRY: ghcr.io
      IMAGE_NAME: ${{ github.repository }}

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,prefix=sha-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha         # GitHub Actions cache
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_APP_URL=https://ai-folio.fly.dev

      - name: Deploy to Fly.io
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Run flyctl deploy
        run: flyctl deploy --image ghcr.io/${{ github.repository }}:sha-${{ github.sha }} --app ai-folio
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### 3. Store secrets in GitHub

**Settings** → **Secrets and variables** → **Actions**:

| Secret name | Value |
|---|---|
| `FLY_API_TOKEN` | From `flyctl auth token` |
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `NEXTAUTH_SECRET` | A long random string |
| `DATABASE_URL` | Your production Postgres URL |

These are injected into workflow steps via `${{ secrets.<NAME> }}` — never printed in logs.

### 4. Configure Fly.io app secrets

Fly.io needs the same secrets to be available at runtime (not just build time):

```bash
flyctl secrets set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  NEXTAUTH_SECRET="..." \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  NEXTAUTH_URL="https://ai-folio.fly.dev" \
  --app ai-folio
```

Fly stores these securely and injects them as environment variables into every machine.

### 5. Tag strategy

The `docker/metadata-action` generates two tags:

- `sha-<commit-sha>` — immutable reference to this exact build; used in `flyctl deploy --image`
- `latest` — always points to the most recent main branch build; useful for manual pulls

Using the SHA tag in `flyctl deploy` ensures you deploy exactly what CI built, even if `latest` has moved.

### 6. Cache Docker layers in CI

The `cache-from: type=gha` / `cache-to: type=gha,mode=max` pair uses GitHub's cache storage for Docker BuildKit layers. On a warm cache, the `pnpm install` and even the `pnpm build` layers may be skipped, cutting build time from ~5 minutes to ~1 minute.

## Test it

Merge a PR to `main`. Watch the Actions tab:

1. `lint`, `typecheck`, `test` run in parallel (all must pass)
2. `deploy` starts only after all three are green
3. Docker image is built and pushed to GHCR
4. `flyctl deploy` runs and Fly.io shows a new release in `flyctl status --app ai-folio`

```bash
flyctl status --app ai-folio
flyctl logs --app ai-folio
```

The app should be live at `https://ai-folio.fly.dev`.

## Mini-task
Add a `notify` step at the end of the `deploy` job that posts to Slack (or just prints to the Actions log) the deployed URL and commit SHA. Use the `GITHUB_SHA` variable and format a message like `Deployed sha-abc123 to https://ai-folio.fly.dev`.

## Glossary
- **GHCR** — GitHub Container Registry; stores Docker images alongside your repository.
- **`needs:`** — declares job dependencies; the dependent job runs only after all named jobs succeed.
- **`docker/build-push-action`** — official Docker GitHub Action for building and pushing images with BuildKit.
- **`docker/metadata-action`** — generates image tags and labels from Git context (branch, SHA, tags).
- **`flyctl deploy --image`** — tells Fly.io to deploy a pre-built image rather than building from source.
- **`type=gha` cache** — BuildKit cache backend that stores layers in GitHub Actions cache storage.

## Resources
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [docker/build-push-action](https://github.com/docker/build-push-action)
- [Fly.io — GitHub Actions deployment](https://fly.io/docs/app-guides/continuous-deployment-with-github-actions/)
- [docker/metadata-action](https://github.com/docker/metadata-action)

## Checklist
- [ ] `deploy` job depends on `lint`, `typecheck`, `test` via `needs:`
- [ ] `deploy` only runs on pushes to `main` (not PRs)
- [ ] Docker image built and pushed to GHCR with SHA tag
- [ ] `FLY_API_TOKEN` stored as GitHub Actions secret
- [ ] `flyctl deploy` runs in CI and deploys the exact SHA-tagged image
- [ ] Production secrets set via `flyctl secrets set` (not in workflow YAML)
- [ ] `flyctl status` confirms new release after merge to `main`
