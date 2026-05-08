# Day 1 — Install tools

## Goal
Have **Node.js LTS**, **npm**, **Git**, and **Docker Desktop** installed and verified.

## Estimated time
~45 minutes (mostly downloads).

## Prerequisites
None.

## Where to put your code
Nothing to commit yet. Tomorrow we create the first project folder.

## Explanation

- **Node.js** is the JavaScript runtime. Like PHP-CLI but for JS. Use the **LTS** version (currently 20.x or 22.x).
- **npm** ships with Node. Like Composer for PHP.
- **Git** — you already use it. Just make sure it works on the command line.
- **Docker Desktop** — we'll use it from Day 16 to run Postgres without installing it system-wide.

## Step-by-step

### 1. Install Node
- Go to https://nodejs.org and install the **LTS** version.
- (Optional, recommended) install via a version manager:
  - macOS / Linux: `nvm` — https://github.com/nvm-sh/nvm
  - Windows: `nvm-windows` — https://github.com/coreybutler/nvm-windows
- Verify:
  ```bash
  node -v   # v20.x.x or v22.x.x
  npm -v    # 10.x or higher
  ```

### 2. Verify Git
```bash
git --version
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

### 3. Install Docker Desktop
- https://www.docker.com/products/docker-desktop/
- Verify after start:
  ```bash
  docker --version
  docker run hello-world
  ```

### 4. Pick your editor
PhpStorm or WebStorm (free trial available). VS Code is also fine. We configure it on Day 3.

## Mini-task
Run `node` in the terminal to open the REPL. Type `1 + 1`, press Enter, then `.exit`.

## Glossary
- **Node.js** — JavaScript runtime built on V8.
- **npm** — Node Package Manager.
- **LTS** — Long-Term Support release.

## Resources
- [Node.js downloads](https://nodejs.org/en/download)
- [nvm](https://github.com/nvm-sh/nvm)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Checklist
- [ ] `node -v` works
- [ ] `npm -v` works
- [ ] `git --version` works
- [ ] `docker run hello-world` works
