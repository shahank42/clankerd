# Clankerd

<!-- effect-solutions:start -->

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.

<!-- effect-solutions:end -->

## Local Effect Source

The Effect v4 repository is cloned to `~/.local/share/effect-solutions/effect` for reference.
Use this to explore APIs, find usage examples, and understand implementation
details when the documentation isn't enough.

## Development

This project uses [Bun](https://bun.sh) as the runtime and package manager.

- `bun run dev` — start with hot reload
- `bun run typecheck` — run TypeScript type checking
- `bun run start` — run the application
- `bun run lint` — run oxlint
- `bun run lint:fix` — run oxlint with auto-fix
- `bun run format` — format with oxfmt
- `bun run format:check` — check formatting with oxfmt

## Technology Stack

- **Runtime:** Bun
- **Framework:** Effect v4 (beta)
- **Platform:** `@effect/platform-bun`
- **Linter:** Oxlint
- **Formatter:** Oxfmt
