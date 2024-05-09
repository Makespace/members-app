# Member Number Service

This service is deployed at [membership.makespace.org](https://membership.makespace.org)

A [sandbox instance](https://member-number-lookup-sandbox-fnl2w3f7da-nw.a.run.app) is also available.

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

## Run tests and lint

```
make check
make smoketest
```

## Operations

- every commit on `main` gets tested in CI and automatically deployed to a sandbox environment
- to release to prod run `make release`

## Calling commands via API

### Link a member number with an email

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
--data '{"memberNumber": "1234", "email": "foo@example.com"}' http://localhost:8080/api/link-number-to-email

### DeclareSuperUser

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
--data '{"memberNumber": "1234", "declaredAt": "2023-01-20"}' http://localhost:8080/api/declare-super-user

### CreateArea

curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
--data '{"name": "Woodspace", "description": "A place for wood"}' http://localhost:8080/api/create-area
