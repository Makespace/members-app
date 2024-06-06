# Member App

A place for us to keep track of:

- which areas contain which red equipment
- who is an owner
- who is a trainer
- who is trained
- who needs training

Architecture:

- login via magic link for anyone with a member number linked to an email address
- only store in this app the information that we can't delegate to third parties
  - member number, email, areas, equipment, owners, trainers, trained is tracked using this applications event store
  - training needed, recurly status, paxton etc. lives in the respective services, this app reads from them on demand and relies on caching where needed
- event store lives in a sqlite database using the `libsql` library so that persistence can be delegated to Turso if need be
- pages are rendered server side with sprinklings of JS for interactivity as needed e.g. GridJS to filter tables

## Try it locally

```
make dev
make populate-local-dev
```

- visit [localhost:8080](http://localhost:8080) to see the application
- visit [localhost:1080](http://localhost:1080) to see the emails it sends

A mailcatcher is provided instead of a real mail server.

Two users are created by `populate-local-dev`:

- `foo@example.com` a regular member
- `admin@example.com` a super user (can e.g. create areas)


## Run tests and lint

```
make check
```

The following is run in CI (see `.github/workflows/ci.yml`)

```
make typecheck lint unused-exports test smoketest
```

## Operations

- every commit on `main` gets tested in CI
- continuous deployment will come soon

## Calling commands via API

### Link a member number with an email

```
curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
--data '{"memberNumber": "1234", "email": "foo@example.com"}' http://localhost:8080/api/link-number-to-email
```

### DeclareSuperUser

```
curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
--data '{"memberNumber": "1234", "declaredAt": "2023-01-20"}' http://localhost:8080/api/declare-super-user
```

### CreateArea

```
curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
--data '{"name": "Woodspace"}' http://localhost:8080/api/create-area
```
