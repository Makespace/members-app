# Member Number Service

This service is deployed at [membership.makespace.org](https://membership.makespace.org)

A [sandbox instance](https://member-number-lookup-sandbox-fnl2w3f7da-nw.a.run.app) is also available.

## Try it locally

```
make dev
```

- visit [localhost:8080](http://localhost:8080) to see the application
- visit [localhost:1080](http://localhost:1080) to see the emails it sends

A mailcatcher is provided instead of a real mail server.

The app is created with no data. To start interacting with it you will need to:

- link some member numbers to email addresses to allow login
- make one of them a super user

See 'Operations' on how to do this.

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
