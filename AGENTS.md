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

## Project Structure

The codebase is organized by **capabilities** (vertical slices / features). Each
capability owns its domain models, errors, and service implementation.

```
src/
  config/          # Configuration management
    domain.ts      # ConfigFile schema, getConfigPath
    errors.ts      # ConfigNotFound, SetupError
    setup.ts       # Interactive setup wizard
    service.ts     # AppConfig Context.Service + layer
  telegram/        # Telegram Bot API client
    domain.ts      # Telegram API schemas
    errors.ts      # TelegramError
    service.ts     # TelegramBot Context.Service + layer
  agent/           # LLM agent integration
    errors.ts      # AgentError
    service.ts     # AgentService Context.Service + layer
  program.ts       # Main polling loop (orchestrates capabilities)
  layers.ts        # Layer composition graph
index.ts           # Entry point
```

### Conventions

- **No barrel files** — import from specific files, e.g.
  `import { AppConfig } from "./config/service.js"`
- **All files and folders in kebab-case** — `config/service.ts`, not
  `Config/Service.ts`
- **Errors co-located with capabilities** — each capability defines its own
  `errors.ts`. There is no shared global errors file.
- **Domain is pure data** — `domain.ts` files contain only schemas and
  constants, no effects or services.
- **Services own their initialization** — `Context.Service` `make` effects
  handle setup, validation, and resource acquisition. The entry point just
  provides layers and runs.

### Adding a new capability

1. Create a new folder under `src/` in kebab-case.
2. Add `domain.ts` for schemas, `errors.ts` for tagged errors, and
   `service.ts` for the `Context.Service` class.
3. Import the service in `src/layers.ts` and wire it into `appLayer`.
4. Import the service in `src/program.ts` to use it.

### Shared code

Avoid shared code. If two capabilities need the same thing, determine which one
_owns_ it and import from there. Only create a `src/shared/` folder for
pure utilities that have no domain meaning (e.g. schema refinements, retry
policies). Services and layers never go in `shared/`.
