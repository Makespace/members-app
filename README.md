# Member App

A place for us to keep track of:

- which areas contain which red equipment
- who is an owner
- who is a trainer
- who is trained
- who needs training

Currently deployed to: [makespace-members-app.fly.dev](https://makespace-members-app.fly.dev/) with no persistence across deployments.

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
--data '{"memberNumber": "1234"}' http://localhost:8080/api/declare-super-user
```

### CreateArea

```
curl -X POST -H 'Authorization: Bearer secret' -H 'Content-Type: application/json' \
--data '{"name": "Woodspace"}' http://localhost:8080/api/create-area
```

## Testing
When writing tests conceptionally the code can be split into 2 sections. The code responsible for writing events
(commands) and the code for reading events (read models). When testing generally it should be split so that
any testing that involves reading is done by providing the events to a read-model and any testing that involves
writing should be done by asserting the resulting events. In theory this would mean that we never call a
command.process from within the read-models part of the tests and we never call a read-model from the commands
part of the tests. In reality we do still call command.process within the read-model tests just so that we can use
it to generate the required events we need without having to do that manually.

## Import from legacy DB

To import members, use GCP console to export a CSV using the following query:

```sql
SELECT Member_Number, Account_Code
FROM members.RecurlyAccounts
JOIN members.MemberRecurlyAccount
JOIN members.Members
ON MemberRecurlyAccount.Member = Members.idMembers
AND RecurlyAccounts.idRecurlyAccounts = MemberRecurlyAccount.RecurlyAccount;
```

Set `ADMIN_API_BEARER_TOKEN` and `PUBLIC_URL` to match the instance you want to import into.

```sh
cat /tmp/members.csv | cut -d ',' -f 1,3 | sed 's/,"/ /' | sed 's/"//' | xargs -n 2 ./scripts/import-member.sh
```
