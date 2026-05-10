# Day 3 — IDE tips for JS/TS (PhpStorm / WebStorm)

## Goal
Configure your IDE for productive TS/Node work — plugins, settings, run configurations and shortcuts.

## Estimated time
~1 hour.

## Prerequisites
PhpStorm or WebStorm installed. (Tips also apply to IntelliJ Ultimate.)

## Where to put your code
No code today. Settings only.

## Explanation
In PhpStorm you already have first-class JS/TS support. WebStorm is the same minus PHP. Both share the same shortcuts and run configurations. The goal today is to make `Run`, `Debug`, `Test`, formatting and ESLint work seamlessly.

## Step-by-step

### 1. Install / enable plugins
- **Node.js** (bundled in WebStorm; install in PhpStorm via `Settings → Plugins`)
- **Tailwind CSS** (we'll need it later)
- **Prisma** (later)
- **.env files support** (bundled)
- **Conventional Commit** (optional)

### 2. Set the Node interpreter
`Settings → Languages & Frameworks → Node.js` → pick your installed Node. Enable **Coding assistance for Node.js**.

### 3. JavaScript / TypeScript versions
`Settings → Languages & Frameworks → JavaScript` → set version to **ECMAScript 2022+**.
For TS: enable **TypeScript service** (uses your project's `typescript` package).

### 4. ESLint + Prettier
- `Settings → ... → ESLint` → **Automatic ESLint configuration**.
- `Settings → ... → Prettier` → **Automatic Prettier configuration**, enable **On save** and **On reformat**.
- We install ESLint/Prettier in projects when needed.

### 5. Run configurations
- Right-click `package.json` → **Show npm Scripts**. Double-click any script to run it as a saved configuration.
- Right-click any test file → **Run / Debug 'test name'** to run a single test.
- Save run configurations as **Project files** so you can commit them (folder `.run/`).

### 6. Debugging
- For Node: `Run → Edit Configurations → +` → **npm** → script: `dev`. Use the **Debug** button instead of Run.
- Set breakpoints by clicking the gutter. The variables panel shows live values.

### 7. Useful shortcuts (default)

| Action | macOS | Win/Linux |
| --- | --- | --- |
| Search everywhere | ⇧ ⇧ | Shift Shift |
| Find action | ⌘ ⇧ A | Ctrl Shift A |
| Go to file | ⌘ ⇧ O | Ctrl Shift N |
| Go to symbol | ⌘ ⌥ O | Ctrl Alt Shift N |
| Go to declaration | ⌘ click | Ctrl click |
| Refactor / rename | ⇧ F6 | Shift F6 |
| Reformat | ⌘ ⌥ L | Ctrl Alt L |
| Optimize imports | ⌃ ⌥ O | Ctrl Alt O |
| Run last | ⌃ R | Shift F10 |
| Debug last | ⌃ D | Shift F9 |
| Terminal | ⌥ F12 | Alt F12 |
| Multi-cursor | ⌥ click | Alt click |

### 8. Live templates worth adding
- `cl` → `console.log($EXPR$)`
- `it` → `it('$DESC$', () => { $END$ })`
- `desc` → `describe('$NAME$', () => { $END$ })`

### 9. .editorconfig
Create one in your repo root so the IDE uses consistent formatting:

```ini name=.editorconfig
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

## Mini-task
Open yesterday's `nauka-node` project in the IDE and:
1. Run `npm start` from the npm scripts panel.
2. Set a breakpoint inside `greet`, run with **Debug**, step into the call.

## Glossary
- **Run configuration** — saved "how to run X" recipe in the IDE.
- **Live template** — IDE snippet expanded by an abbreviation + Tab.

## Resources
- [PhpStorm — Node.js](https://www.jetbrains.com/help/phpstorm/developing-node-js-applications.html)
- [WebStorm — TypeScript](https://www.jetbrains.com/help/webstorm/typescript-support.html)
- [JetBrains shortcut reference (PDF)](https://resources.jetbrains.com/storage/products/webstorm/docs/WebStorm_ReferenceCard.pdf)

## Checklist
- [x] Node interpreter set
- [x] ESLint + Prettier auto-configured
- [x] You ran `npm start` from the IDE
- [x] You hit a breakpoint with the debugger
