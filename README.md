# Member App

A place for us to keep track of:

- which areas contain which red equipment
- who is an owner
- who is a trainer
- who is trained
- who needs training

Currently deployed to: [app.makespace.org](https://app.makespace.org)

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

## DevContainer
Dev containers are a way to create a reproducible dev environment https://code.visualstudio.com/docs/devcontainers/containers.

Setup (vscode):
1. Install the dev container extension from Microsoft
2. Ctrl+Shift+P then type 'Dev Containers: Rebuild and Reopen in Container'
3. Vscode will reload into the dev container - you can now develop with all the required tools already installed
4. Type `make start` to start the application to perform manual local testing.

Each time you start the dev container the database will be reset to empty.

## Testing Google Intergration
To test the google integration populate `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` within `.env`. The credentials can be found by speaking
to the database owners.
