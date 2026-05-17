# Day 106 — GitHub Actions hello

## Goal
Create your first GitHub Actions workflow that runs on every push. After this day you understand the YAML structure of a workflow, what a runner is, how jobs and steps work, and how to read the Actions tab in GitHub.

## Estimated time
~1.5 hours

## Prerequisites
Day 105 (ai-folio running in Docker). A GitHub repository for `ai-folio`.

## Where to put your code
In `ai-folio`, inside `.github/workflows/`.

## Explanation

**GitHub Actions** is a CI/CD platform built into GitHub. You define workflows in YAML files; GitHub executes them on hosted virtual machines ("runners") in response to events (push, PR, schedule, etc.). In Laravel terms, this replaces Envoyer or Deployer scripts: instead of SSHing to a server to run `git pull && php artisan migrate`, you describe the steps declaratively and GitHub runs them automatically.

**A workflow** has three nested levels:
- **workflow** — the file itself; triggers defined by `on:`
- **job** — an isolated machine (runner); jobs run in parallel by default
- **step** — a shell command or a reusable Action inside a job; steps run sequentially

Each job starts on a fresh runner with a clean filesystem. Jobs can share data via **artifacts** (uploaded/downloaded files) or **caches**. Understanding this isolation is key to reasoning about what is available where.

The `actions/checkout@v4` step (the most common first step) clones your repository into the runner. Without it, the runner has no source code.

## Step-by-step

### 1. Create the workflow directory

```bash
mkdir -p .github/workflows
```

### 2. Write the hello workflow

```yaml name=.github/workflows/hello.yml
name: Hello CI

on:
  push:
    branches: ['**']      # every branch
  pull_request:
    branches: ['main']

jobs:
  greet:
    name: Greet the runner
    runs-on: ubuntu-latest

    steps:
      - name: Check out source code
        uses: actions/checkout@v4

      - name: Print environment info
        run: |
          echo "Repository: $GITHUB_REPOSITORY"
          echo "Branch:     $GITHUB_REF_NAME"
          echo "Commit SHA: $GITHUB_SHA"
          echo "Runner OS:  $RUNNER_OS"
          node --version
          npm --version

      - name: List repository files
        run: ls -la

      - name: Confirm checkout
        run: test -f package.json && echo "package.json found" || exit 1
```

### 3. Commit and push

```bash
git add .github/workflows/hello.yml
git commit -m "ci: add hello workflow"
git push
```

### 4. Read the Actions tab

Open your GitHub repository → **Actions** tab. You will see the workflow run in progress. Click it to expand jobs and steps. Each step shows its shell output. A green tick means exit code 0; a red X means non-zero exit.

### 5. Understand the contexts and default env vars

GitHub injects environment variables into every step:

| Variable | Value |
|---|---|
| `GITHUB_REPOSITORY` | `owner/repo` |
| `GITHUB_REF_NAME` | branch or tag name |
| `GITHUB_SHA` | full commit SHA |
| `GITHUB_ACTOR` | username who triggered the run |
| `RUNNER_OS` | `Linux` / `Windows` / `macOS` |

You can also access them via the `github` **context** in expressions: `${{ github.sha }}`.

### 6. Add a manual trigger

```yaml name=.github/workflows/hello.yml
on:
  push:
    branches: ['**']
  pull_request:
    branches: ['main']
  workflow_dispatch:      # allows manual trigger from the GitHub UI
```

After pushing, go to Actions → Hello CI → **Run workflow** button appears.

## Test it

Push any change to any branch. Watch the Actions tab — the `greet` job should complete in under 30 seconds with all steps green. Click the "Print environment info" step and verify `GITHUB_REPOSITORY` matches your repo.

## Mini-task
Add a step that writes a file and a second step that reads it — this confirms steps within a job share a filesystem. Then add a second job that also tries to read the file. Observe that the second job cannot see the file (different runner = different filesystem).

## Glossary
- **Workflow** — YAML file in `.github/workflows/`; defines triggers, jobs, and steps.
- **Runner** — GitHub-hosted virtual machine that executes a job; wiped clean after each run.
- **Job** — isolated unit of work running on one runner; multiple jobs run in parallel by default.
- **Step** — a single shell command (`run:`) or a reusable Action (`uses:`).
- **`actions/checkout@v4`** — official Action that clones the repository into the runner.
- **`workflow_dispatch`** — trigger that enables manual runs from the GitHub UI or API.

## Resources
- [GitHub Actions — quickstart](https://docs.github.com/en/actions/quickstart)
- [GitHub Actions — contexts](https://docs.github.com/en/actions/learn-github-actions/contexts)
- [GitHub Actions — default env vars](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables)

## Checklist
- [ ] `.github/workflows/hello.yml` created
- [ ] Workflow triggers on push and PR
- [ ] `workflow_dispatch` trigger added for manual runs
- [ ] Workflow run visible in Actions tab with all steps green
- [ ] Environment variables (`GITHUB_REPOSITORY`, `GITHUB_SHA`) visible in step output
