# Gmail import: management@ mail in the app

Imports mail sent to `management@makespace.org` into the app (read-only in
this iteration) so managers can read member email at `/mailbox` — and, in
follow-up PRs, create trouble tickets from emails and send templated replies.

**Key wrinkle: `management@makespace.org` is a Google *group*, not an
account.** Groups have no mailbox of their own — Gmail just fans their mail
out to member accounts — so there is nothing to authenticate as and no inbox
to read directly. The import therefore authenticates as a real *member
account* of the group (`it-owners@makespace.org`, which receives the group's
mail) and filters the import down to messages addressed/delivered to the
group, so the member account's unrelated mail stays out of the app.

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
| `GMAIL_IMPORT_MAILBOX` | The **account** the import authenticates as and reads, e.g. `it-owners@makespace.org`. Must be a real account (not a group). Empty (the default) disables the import entirely. |
| `GMAIL_FILTER_TO_ADDRESS` | When set (e.g. `management@makespace.org`), only messages addressed or delivered to this address are cached — use this when the interesting address is a group the account is a member of. Bootstrap listings filter server-side (`deliveredto:`); incremental pulls filter on the To/Cc/Delivered-To headers. Empty imports the whole inbox. |
| `GMAIL_AUTHORIZED_USER_JSON` | **Fly secret** (never fly.toml): an authorized-user OAuth credential for the mailbox account - see Option A. When set, it is preferred and no domain-wide delegation is needed. |
| `MANAGEMENT_TEAM_AREA_ID` | Area whose owners may view `/mailbox`. Empty = super-users only. Find the id on `/db` with `SELECT id, name FROM areas`. |

Setting `GMAIL_IMPORT_MAILBOX` before the delegation grant has propagated is
safe: the sync logs a clear auth error each cycle and imports nothing.

## Credentials: two supported options

### What the three values are

| Value | Identifies | Where it comes from |
| --- | --- | --- |
| `client_id` | *Which application* is asking - our registration in a Google Cloud project. Public by design. | Cloud Console; readable at any time |
| `client_secret` | Proof the request really is that application. | Cloud Console; readable at any time |
| `refresh_token` | *Which Google account* granted that application permission, and for which scopes. | Cannot be looked up - it exists only once someone signs in and consents |

A refresh token is only valid for the client that minted it, so a new
client id/secret always needs a new token. Mixing them gives
`unauthorized_client`; a wrong secret gives `invalid_client`.

### Setting it up from scratch on the Workspace domain

1. **console.cloud.google.com** -> create (or reuse) a project.
2. **APIs & Services -> Library** -> enable the **Gmail API**.
3. **OAuth consent screen** -> **Internal**. Internal apps skip Google's
   verification *and* are not subject to the 7-day refresh-token expiry that
   kills Testing-mode tokens. This is the main reason to do this on a
   Workspace account rather than a personal one.
4. **Credentials -> Create credentials -> OAuth client ID**. Either:
   - **Desktop app** - works with `scripts/mint-gmail-token.ts` below with no
     further configuration; or
   - **Web application** - add `http://localhost:4571/callback` (for the
     script) or `https://developers.google.com/oauthplayground` (for Option A)
     to its authorized redirect URIs.
5. Mint the refresh token **signed in as the mailbox account** - the inbox the
   app reads, which need not be the account that owns the project.

### Minting the token locally (easiest)

```
bun scripts/mint-gmail-token.ts <client-id> <client-secret>
```

It opens a browser, waits for the consent redirect on localhost, and prints
the ready-made `fly secrets set` line. If Google returns no refresh token and
no error, this account has already granted this client - revoke it at
https://myaccount.google.com/permissions and run it again.

### Option A: an OAuth token for the mailbox account itself

The narrowest option - it touches exactly one mailbox and needs no
domain-wide grant. Someone who can sign in as the mailbox account mints a
refresh token with the `gmail.readonly` scope and it becomes a Fly secret:

1. In the Google Cloud console (any project), create an **OAuth client ID**
   (Desktop app is simplest) - or reuse an existing one. A **Web
   application** client also works, but the OAuth Playground's redirect URI
   (`https://developers.google.com/oauthplayground`) must be added to its
   authorized redirect URIs first. Note the client ID and client secret.
2. **Publish the OAuth consent screen to "In production"** (Testing-mode
   refresh tokens expire after 7 days - this is the classic trap).
3. Mint the token while signed in AS the account (`it-owners@`), consenting
   to the `https://www.googleapis.com/auth/gmail.readonly` scope - the OAuth
   Playground (https://developers.google.com/oauthplayground, with "Use your
   own OAuth credentials" ticked) is the quickest way: authorise the scope,
   exchange for tokens, copy the refresh token.
4. Set the secret (never goes in fly.toml or the repo):

   ```
   fly secrets set -a makespace-app GMAIL_AUTHORIZED_USER_JSON='{"type":"authorized_user","client_id":"<id>","client_secret":"<secret>","refresh_token":"<token>"}'
   ```

Caveats: the token dies if the account's password is reset, the grant is
revoked from the account's security page, or the consent screen is left in
Testing mode. The sync's auth errors in the logs are the tell.

For the group-filtered setup, the account must actually be a member of the
group (so the group's mail is delivered to its inbox), and the group's
delivery setting must not be "No email".

### Option B: domain-wide delegation (needs a Workspace super admin)

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
