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

- `make dev` to start the local Docker-backed development stack
- `make dev-all` to start the broader local development workflow
- `make populate-local-dev` to seed the local stack with test data
- `./scripts/login.ts admin` to automate logging into the seeded admin account
- `make test` to run all tests
- `npx jest path/to/test.test.ts` to run a single test file
- `make lint` to run ESLint
- `make typecheck` to run type checking without emitting files
- `make watch-typecheck` to run type checking in watch mode
- `make unused-exports` to detect unused exports
- `make audit` to run the Bun security audit
- `make smoketest` to run smoke tests
- `make check` to run the standard verification suite: test, lint, typecheck, unused-exports, audit
- `make fix` to apply automatic ESLint fixes

Use `make start` only inside the devcontainer. It is not the normal local app entrypoint.

Local app stack endpoints:

- App: `http://localhost:8080`
- Mailcatcher: `http://localhost:1080`

Seeded local users created by `make populate-local-dev`:

- `foo@example.com` for a regular member
- `admin@example.com` for a super user

## Architecture

This app is built around event sourcing.

- Commands live in `src/commands/`
- Read models live in `src/read-models/`
- Queries live in `src/queries/`
- Authentication flows live in `src/authentication/`
- Background sync code lives in `src/sync-worker/`
- HTTP handlers live in `src/http/`
- Top-level routes are wired in `src/routes.ts`
- Event store code lives in `src/init-dependencies/event-store/`

Important boundaries:

- Commands validate authorization and business rules, then emit domain events.
- Commands should only use the events passed to them. They should not query read models directly.
- Read models project events into queryable state.
- Queries read from read models and render HTTP responses.
- Read models are eventually consistent, so do not assume command results are immediately visible in read-side code.
- The sync worker ingests external state and turns it into events instead of bypassing the event model.
- Communication across the app should happen via events, not by coupling command code to read-model code.

Important domain notes:

- Events are immutable facts. Prefer adding a new event over mutating prior state assumptions.
- The event store uses optimistic concurrency and resource versioning.
- Authentication is passwordless and handled by magic link flows under `src/authentication/`.
- Member numbers are linked to email addresses through domain events.
- Actor types include `system`, `token`, and `user`.
- Be careful with authorization, session, and member-linking changes.

External integrations:

- Recurly provides subscription-related data.
- Google Sheets provides training and trouble-ticket data.
- Paxton data is read from an external service.
- Sync-related tests commonly use fixtures under `tests/data/`.

## Project patterns

- Prefer existing fp-ts patterns such as `TaskEither`, `Option`, and `pipe`.
- Use existing io-ts types and decoders where applicable.
- Use `deps.logger` for logging instead of `console.log`.
- Follow the repo's current style rather than introducing a new abstraction or library unless necessary.
- Keep changes small and targeted.
- Preserve the existing command, read-model, query, and sync-worker boundaries instead of shortcutting across layers.
- When wiring new behavior, prefer extending the matching layer and handler path rather than adding ad hoc logic to routes or HTTP glue.

## Testing guidance

Tests live under `tests/` and usually mirror the source layout.

- Use `.test.ts` files.
- Command tests should assert on resulting events.
- Read-model tests should feed events into the read model and assert on query results.
- It is acceptable in read-model tests to use `command.process()` only to generate events for setup.
- Avoid calling read models from command tests.
- Tests should follow a behaviour-driven style.

Directory mapping notes:

- Most source paths map directly into `tests/`
- Before creating a new test file, inspect nearby tests and follow the local naming convention already in use.

Helpful test utilities already used in the repo:

- `faker` for test data
- `jest-date-mock` for date-sensitive tests
- `tests/helpers.ts` for shared test helpers
- `tests/data/` for external-data fixtures

When adding or updating tests:

- Prefer concrete, explicit test cases over callback-driven table tests when there are only a small number of scenarios.
- Prefer a nested `describe` with shared `beforeEach` setup for closely related scenarios instead of selector/helper functions inside the test cases.
- Keep test setup and assertions locally readable; avoid introducing indirection in tests unless it removes substantial duplication.

## Working norms for agents

- Prefer `rg` for searching the codebase.
- Before broader verification, run the smallest relevant check for the files you changed when practical.
- If you change behavior, add or update tests in the matching area under `tests/`.
- Preserve the command/read-model separation when adding features.
- Avoid speculative refactors unless they are necessary for the task.
- Do not overwrite unrelated local changes.
- Check `Makefile`, nearby tests, and existing module patterns before introducing a new command or workflow.

## Useful references

- `README.md` for local setup, login flow, and operational context
- `CLAUDE.md` for deeper repository architecture guidance
- `Makefile` for the canonical development, verification, and helper commands
