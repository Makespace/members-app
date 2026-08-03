# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `make dev-all` - Start all dev processes (Docker, type checker, tests) in one command
- `make dev` - Start local development server with Docker Compose only
- `make populate-local-dev` - Populate local database with test users (foo@example.com, admin@example.com)
- `./scripts/login.ts admin` - Automated login helper for dev server

### Testing & Quality
- `make check` - Run all checks (equivalent to: test, lint, typecheck, unused-exports)
- `make test` or `npx jest` - Run all tests
- `npx jest path/to/test.test.ts` - Run a single test file
- `make lint` - Run ESLint
- `make typecheck` - Type check without emitting files
- `make watch-typecheck` - Watch mode for type checking
- `make unused-exports` - Find unused exports

### Other
- `make fix` - Auto-fix linting issues
- `make smoketest` - Run smoke tests
- Local app: http://localhost:8080
- Mailcatcher (dev emails): http://localhost:1080

## Architecture

### Event Sourcing Pattern
This application uses **event sourcing** as its core architectural pattern. All state changes are captured as immutable events stored in a SQLite database (via libsql/Turso).

#### Commands (Write Side)
- Located in `src/commands/`
- Commands validate authorization and business rules, then produce domain events
- Each command implements the `Command<T>` interface (see `src/commands/command.ts`) with:
  - `process({ command, rm, deps? })` - validates business logic and returns `TaskEither<FailureWithStatus, Option<DomainEvent>>` (async; `O.none` means "no event, nothing to do")
  - `decode` - an io-ts codec's `.decode` that validates and decodes input data
  - `isAuthorized({ actor, rm, input })` - checks if the actor can execute this command
- Commands receive the `SharedReadModel` as `rm` and query its views directly for business rules (e.g. `input.rm.area.get(id)`). They do NOT replay raw events themselves.
- A command's only side effect is returning the event(s) to append - it never writes to the store directly

#### Events (Domain Events)
- Defined in `src/types/domain-event.ts`
- All events extend a base with: `type`, `actor`, `recordedAt`
- Use `constructEvent(eventType)(payload)` helper to create new events
- Events are immutable and represent facts that occurred
- Event store located in `src/init-dependencies/event-store/`
- Optimistic concurrency control via resource versioning

#### Read Models (Read Side)
- Located in `src/read-models/`
- **SharedReadModel** (`src/read-models/shared-state/`) is the primary read model
  - Initialized from scratch in-memory on startup using better-sqlite3
  - Rebuilt from event store by replaying all events
  - Refreshed every 10 seconds via `periodicReadModelRefresh`
  - Also pulls external data (Recurly, Google Sheets) every 60 seconds
  - Provides views for members, equipment, areas, super users, etc.
  - Uses Drizzle ORM for SQL operations
- Read models project events into queryable views optimized for reads
- Read models are eventually consistent (10s refresh cycle)

#### Queries (HTTP Read Side)
- Located in `src/queries/`
- Queries read from the SharedReadModel and render HTML responses
- Each query implements the `Query` type (see `src/queries/query.ts`)
- Queries are curried: `(deps) => (user, params, queryParams) => TaskEither<FailureWithStatus, HttpResponse>`

### Separation Principle
The codebase maintains separation between the write side and read side:
- **Commands** read from the `SharedReadModel` (`rm`) to validate business rules, but their only output is domain events - they never write to the event store directly
- **Read models** should only process events, never call `command.process()` (except in tests to generate test events)
- All state changes flow through events; the read model is rebuilt from those events
- This makes testing easier and allows independent evolution of read/write sides

### Authentication
- Magic link authentication (passwordless) via `src/authentication/`
- Login requires member number linked to an email address
- Uses Passport.js with custom strategy
- Session management via cookie-session
- Three actor types: `system`, `token` (API), `user` (logged in member)

### External Integrations
- **Recurly**: Subscription status, payment information
- **Google Sheets**: Training quiz results and trouble tickets
- **Paxton**: Access control (read from external service)
- Sync worker (`src/sync-worker/`) periodically syncs external data into events

### Database
- **Event Store**: SQLite database (can use Turso for remote persistence)
  - Stores all domain events with optimistic concurrency control
  - Schema in `src/init-dependencies/event-store/events-table.ts`
- **Read Model DB**: In-memory SQLite rebuilt on startup
  - Separate read-only connection for queries
  - Schema defined in `src/read-models/shared-state/state.ts`
- **Google DB**: Caches Google Sheets data

### HTTP Layer
- Express.js server in `src/index.ts`
- Routes defined in `src/routes.ts`
- HTTP handlers in `src/http/`:
  - `command-to-handlers.ts` - POST handlers that execute commands
  - `query-to-handler.ts` - GET handlers that execute queries
  - `api-to-handlers.ts` - API endpoints with bearer token auth

### Technology Stack
- **Runtime**: Node.js 20 with Bun for package management
- **Language**: TypeScript with strict typing
- **Database**: SQLite via @libsql/client (Turso compatible)
- **ORM**: Drizzle ORM for read models
- **Functional Programming**: fp-ts for TaskEither, Option, pipe patterns
- **Validation**: io-ts for runtime type checking
- **Server**: Express.js with Passport for authentication
- **Email**: MJML for templates, Nodemailer for sending
- **Testing**: Jest with ts-jest
- **Linting**: ESLint

## Testing Guidelines

### Test Organization
- Tests are in `tests/` directory (not colocated with source)
- Mirror source structure: `tests/commands/`, `tests/read-models/`, `tests/queries/`
- Use `.test.ts` extension

### Testing Commands
- Seed state via a `TestFramework` from `initTestFramework()` (provides `sharedReadModel`), then assert on the resulting event
- Use `command.process({ command: { ...fields, actor }, rm: framework.sharedReadModel })` - it returns a `TaskEither`, so unwrap with `getTaskEitherRightOrFail()` from `tests/helpers`
- Example: `tests/commands/area/create.test.ts`
- Use `constructEvent(type)(payload)` to build test events
- Use `arbitraryActor()` from `tests/helpers` for actor values

### Testing Read Models
- Provide events to read model, assert on query results
- It's acceptable to use `command.process()` in read model tests ONLY to generate required events
- Never call read models from command tests

### Testing Utilities
- `faker` for generating test data
- `jest-date-mock` for mocking dates
- Use io-ts types (e.g., `UUID`, `NonEmptyString`) for type-safe test data

## Common Patterns

### fp-ts Usage
- `TaskEither<Error, Success>` for async operations that may fail
- `Option<T>` for values that may or may not exist
- `pipe()` for composing operations
- `TE.tryCatch()`, `TE.chain()`, `TE.map()` for TaskEither operations
- `O.some()`, `O.none`, `O.isSome()` for Option operations

### Authorization
- Helper functions in `src/commands/`:
  - `is-admin-or-super-user.ts`
  - `is-equipment-owner.ts`
  - `is-equipment-trainer.ts`
  - `is-self-or-privileged.ts`
- Authorization checked before command processing via `isAuthorized()`

### Member Linking
- Members identified by member number (integer)
- Email addresses linked to member numbers via events
- `MemberLinking` class in read model handles email ↔ member number lookups

## API Endpoints

Bearer token authentication required (header: `Authorization: Bearer <ADMIN_API_BEARER_TOKEN>`):

- `POST /api/link-number-to-email` - Link member number with email
- `POST /api/declare-super-user` - Grant super user privileges
- `POST /api/create-area` - Create a new area

See README.md for curl examples.

## Development Notes

- Server renders pages server-side with minimal client JS (e.g., GridJS for tables)
- Use `deps.logger` (pino) for logging, not console.log
- Configuration loaded from environment via `src/configuration.ts`
- Session secret and token secret must be set in production
- Deployment to Fly.io (makespace-app.fly.dev) and app.makespace.org
