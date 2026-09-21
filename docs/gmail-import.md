# Gmail import: management@ mailbox in the app

Imports the management mailbox into the app (read-only in this iteration) so
managers can read member email at `/mailbox` — and, in follow-up PRs, create
trouble tickets from emails and send templated replies.

## How it works

- The sync worker polls the Gmail API every 5 minutes using the **same
  service-account key as the sheet sync** (`GOOGLE_SERVICE_ACCOUNT_KEY_JSON`),
  with a second auth scope (`gmail.readonly`) and **impersonation** of the
  mailbox via domain-wide delegation.
- First run imports the whole INBOX; after that it's incremental via Gmail's
  `historyId` cursor (with an automatic full re-list if the cursor expires —
  Google keeps them for roughly a week).
- Messages land in a **mutable cache table** (`gmail_message` in the
  external-state DB), like the sheet caches — deliberately *not* the event
  log: bodies are PII and retention must stay trivial. Only curated facts
  (e.g. "ticket created from message X") will become events.
- `/mailbox` (list + message detail) is visible to **super-users and owners
  of the management team's area** only. Bodies render as escaped plain text;
  attachments are listed by name but not imported.

## Configuration (Fly env)

| Variable | Meaning |
| --- | --- |
| `GMAIL_IMPORT_MAILBOX` | The mailbox to import, e.g. `management@makespace.org`. Empty (the default) disables the import entirely. |
| `MANAGEMENT_TEAM_AREA_ID` | Area whose owners may view `/mailbox`. Empty = super-users only. Find the id on `/db` with `SELECT id, name FROM areas`. |

Setting `GMAIL_IMPORT_MAILBOX` before the delegation grant has propagated is
safe: the sync logs a clear auth error each cycle and imports nothing.

## One-time Google Workspace setup (needs a Workspace super admin)

1. **Google Cloud console** → the project that owns the sheet-sync service
   account → IAM & Admin → Service accounts → copy the account's **numeric
   Unique ID** (the "client ID", ~21 digits).
2. **Workspace Admin console** → Security → Access and data control → API
   controls → **Domain-wide delegation** → *Add new*:
   - Client ID: the numeric ID from step 1
   - OAuth scopes: `https://www.googleapis.com/auth/gmail.readonly`
3. Save. Propagation can take up to ~an hour. Some Workspace editions require
   a **second super admin to confirm** the new delegation.
4. No new key or secret is needed — the existing
   `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` is reused.

Note the scope is read-only; replies (a later PR) go out through the existing
Mailjet SMTP path as `it-maintainers@makespace.org`, not through Gmail, and
are tracked as events in the app rather than in the Gmail Sent folder.

## Verifying

1. Set the two env vars on Fly, deploy/restart.
2. Watch the sync worker logs for `Cached N gmail message(s) for …` (or the
   auth error, if delegation hasn't propagated).
3. Open `/mailbox` as a super-user.
