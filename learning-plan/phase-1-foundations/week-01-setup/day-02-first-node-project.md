# Day 2 — First Node project

## Goal
Create your first Node project with `package.json` and run a JavaScript file.

## Estimated time
~45 minutes.

## Prerequisites
Day 1 done.

## Where to put your code
`exercises/phase-1/week-01-setup/nauka-node/`

## Explanation

A Node project is just **a folder with a `package.json`**. There is no `composer.json` equivalent split between `require` and `require-dev` — it's `dependencies` and `devDependencies` in one file. `node_modules/` is like `vendor/`.

## Step-by-step

```bash
mkdir -p exercises/phase-1/week-01-setup/nauka-node
cd exercises/phase-1/week-01-setup/nauka-node
npm init -y
```

This creates `package.json`. Open it and notice fields like `name`, `version`, `main`, `scripts`.

Create `src/index.js`:

```js name=src/index.js
console.log('Hello from Node!');
console.log('Today is', new Date().toISOString());
```

Run it:

```bash
node src/index.js
```

Add a script to `package.json`:

```json
"scripts": {
  "start": "node src/index.js"
}
```

Now `npm start` runs the same thing.

## Mini-task
Write a function `greet(name)` that returns `"Hello, <name>!"` and log the result of `greet('Marcin')`.

## Glossary
- **`package.json`** — manifest of your project.
- **`node_modules/`** — installed dependencies (like `vendor/`).
- **npm script** — named command runnable via `npm run <name>`.

## Resources
- [npm-init docs](https://docs.npmjs.com/cli/v10/commands/npm-init)
- [package.json docs](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)

## Checklist
- [ ] `package.json` exists
- [ ] `npm start` prints your message
- [ ] Folder committed to git
