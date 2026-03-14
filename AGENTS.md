# AGENTS.md

Guidance for coding agents working in this repository.

## Quick start

- Runtime: Node.js 20
- Package manager: Bun
- Language: TypeScript
- Test runner: Jest with `ts-jest`
- Linting: ESLint
- Primary workflow entrypoint: `make`

Prefer these commands:

- `make check` to run all the verification steps
- `make test` to run all tests
- `npx jest path/to/test.test.ts` to run a single test file
- `make lint` to run ESLint
- `make typecheck` to run check types
- `make unused-exports` to detect unused exports
- `make start` to start the local app stack
- `make populate-local-dev` to seed local app stack with data

Local app stack endpoints:

- App: `http://localhost:8080`
- Mailcatcher: `http://localhost:1080`

## Architecture

This app is built around event sourcing.

- Commands live in `src/commands/`
- Read models live in `src/read-models/`
- Queries live in `src/queries/`
- Authentication flows live in `src/authentication/`
- Background sync code lives in `src/sync-worker/`

Important boundaries:

- Commands validate authorization and business rules, then emit domain events.
- Commands should only use the events passed to them. They should not query read models directly.
- Read models project events into queryable state.
- Queries read from read models and render HTTP responses.
- Communication across the app should happen via events, not by coupling command code to read-model code.

## Project patterns

- Prefer existing fp-ts patterns such as `TaskEither`, `Option`, and `pipe`.
- Use existing io-ts types and decoders where applicable.
- Use `deps.logger` for logging instead of `console.log`.
- Follow the repo’s current style rather than introducing a new abstraction or library unless necessary.
- Keep changes small and targeted.

Authentication notes:

- Login is passwordless and handled by magic link flows under `src/authentication/`.
- Member numbers are linked to email addresses through domain events.
- Be careful with authorization and session-related changes.

## Testing guidance

Tests live under `tests/` and mirror the source layout.

- Use `.test.ts` files.
- Command tests should assert on resulting events.
- Read-model tests should feed events into the read model and assert on query results.
- It is acceptable in read-model tests to use `command.process()` only to generate events for setup.
- Avoid calling read models from command tests.
- Tests should follow a behaviour driven testing style

Helpful test utilities already used in the repo:

- `faker` for test data

## Working norms for agents

- Prefer `rg` for searching the codebase.
- Before broader verification, run the smallest relevant check for the files you changed when practical.
- If you change behavior, add or update tests in the matching area under `tests/`.
- Preserve the command/read-model separation when adding features.
- Avoid speculative refactors unless they are necessary for the task.
- Do not overwrite unrelated local changes.

## Useful references

- `README.md` for local setup and operational context
- `CLAUDE.md` for repository guidance already written for coding assistants
- `Makefile` for the canonical development, test, and lint commands
