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

## Logging into the dev server

To login to the dev server navigate to http://localhost:8080 enter a
user email (for example `admin@example.com`) then navigate to
http://localhost:1080 find the email and click login.

This process is automated via helper script. The above flow is
equivalent to:

```
./scripts/login.ts admin
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
cat /tmp/members.csv | sed 's/,"/ /' | sed 's/"//' | xargs -n 2 ./scripts/import-member.sh
```

## Training Sheet IDS
Verified
```
'Metal Lathe': '1Yu8TeG9RTqSEu3dxL5wj8uXfeP3xbIgxQZ1ZB9kyFUE',
```

Not verified
```
'3D_Printer': '1jqzbGuf5m2_cTO3VQv4W5lTurNUeBt0SUMEIPMmhWi0',
'Markforged_Mark_2': '15Ed7mkMud74UV0bNu2jKB8W1MrH_8pUeNIGdrtZqCoo',
'Domino_Joiner': '1tWznV2GQls1a6sopw_lm7Iy58kM3kOCVtG2VDKL6SD4',
'CNC_Router': '1af3nNXVXjYMTuH6F9vAg2CKRIewU3M8-nhUjiRIf8Q0',
'Band_Saw': '11S81Gb-QyFNaI_-RH3Xcrwqtyfd47z7l-lXUAB9SzEY',
'Mitre Saw': '1e9Vgxuh7k01QNrrxGiF6jGUkbFcRK8S2if1FINbCWwY',
'Tormek': '1_40_3xSjgDgLBiccQ7N2KNQvPIo51oPOYkvHo3aF3mY',
'Laser_Cutter': '1481VwMyXeqZDZBkgxn8O-R0oM4mt4mbkN2wzmSNvvBs',
'Wood_Lathe': '1fyEWGyGOYTvMmlMdl58nErFDjubVQBXNRsmQb1td3_c',
'Plunge_Saw': '1fGw4IdAJoGOGZ3hsOo_wEQB0KIQA1PRFDW6XfgY-xmQ',
'CNC_Model_Mill': '1pIhiQY9B1J_kB6azrACeSed1XdGyHPt8z_TLcD-EEQs',
'Plunge_Router': '1G0mvZTuVrvL7GR92wbr15YtRdsDR1IpZFta8AtIJL5I',
'Festool OF1010 Router': '16CvHlJlUt2bOkITgnFd2gwbLN0weTV1u7CuOb2bhyxk',
'Embroidery Machine': '1Krto0mc2clINQJrM8ZJJh0P5hISjt1C3vnK2xQaBATM',
'Planer Thicknesser': '1TVuM9GtSyE8Cq3_p3R3GZOmZE47Au-gSM1B9vXl2JOA',
'Woodworking Handtools': '1CD_Va0th0dJmOSCjVGVCimrzkN7gKGjmMhifv7S9hY0',
'Metal_Mill': '1yulN3ewYS2XpT22joP5HteZ9H9qebvSEcFXQhxPwXlk',
'Form 3 Resin Printer': '1rnG8qvYXL5CucsS7swr9ajGYvHndBG1TKIbyG3KioHc',
'Bambu': '1i1vJmCO8_Dkpbv-izOSkffoAeJTNrJsmAV5hD0w2ADw'
```
