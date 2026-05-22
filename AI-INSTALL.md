# CatPaw Source Bootstrap

This is the source-repository bootstrap for AI agents.

Public source repository:

```text
https://github.com/shiqkuangsan/catpaw
```

## Source Layout

The authored runtime package source lives at:

```text
src/runtime/
```

The generated installable runtime package lives at:

```text
dist/runtime/
```

Generate it with:

```bash
node scripts/build-runtime.mjs
```

## Install / Upgrade From This Checkout

1. Read `src/runtime/AI-INSTALL.md`.
2. Run `node scripts/build-runtime.mjs`.
3. Treat `dist/runtime/` as the runtime package root for install or upgrade.
4. Copy only paths listed in `dist/runtime/runtime-manifest.json` to
   `~/.catpaw/`.

Do not copy repository-root `docs/`, `scripts/`, `.git/`, or future resource
directories into `~/.catpaw/`.

If the user starts from the public GitHub URL instead of an existing checkout,
clone or fetch the repository first, then follow the same source-layout rules.
