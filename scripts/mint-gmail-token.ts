#!/usr/bin/env bun
/**
 * Mints a Gmail refresh token for the mailbox the app imports.
 *
 * Run it on your own machine, sign in as the MAILBOX account (the one whose
 * inbox we read - not necessarily the account that owns the Cloud project),
 * and it prints the fly secrets command to paste. Nothing is written to disk
 * and nothing leaves your machine except the OAuth exchange with Google.
 *
 *   bun scripts/mint-gmail-token.ts <client-id> <client-secret>
 *
 * The OAuth client must be a "Web application" client with
 * http://localhost:4571/callback in its authorized redirect URIs, or a
 * "Desktop app" client (which allows loopback redirects automatically).
 * See docs/gmail-import.md.
 */
import {createServer} from 'http';
import open from 'open';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const PORT = 4571;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const [clientId, clientSecret] = process.argv.slice(2);

if (!clientId || !clientSecret) {
  console.error(
    'usage: bun scripts/mint-gmail-token.ts <client-id> <client-secret>'
  );
  process.exit(1);
}

// Wait for Google to redirect back with ?code=, then shut the server down.
const waitForCode = (): Promise<string> =>
  new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      res.end(
        `<p style="font: 1rem system-ui; padding: 2rem">${
          code
            ? 'Done - you can close this tab and go back to the terminal.'
            : `Something went wrong: ${error ?? 'no code returned'}`
        }</p>`
      );
      server.close();
      if (code) {
        resolve(code);
      } else {
        reject(new Error(error ?? 'no code returned'));
      }
    });
    server.listen(PORT);
  });

const main = async () => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  // offline + consent together are what actually produce a refresh token:
  // without them Google returns only a short-lived access token, or reuses a
  // previous grant and returns no refresh token at all.
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\nSign in as the MAILBOX account (the inbox the app reads).');
  console.log('Opening your browser...\n');
  const codePromise = waitForCode();
  await open(authUrl.toString());
  console.log(`If it did not open, visit:\n${authUrl.toString()}\n`);

  const code = await codePromise;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const body = (await response.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.refresh_token) {
    console.error('\nGoogle refused to issue a refresh token:');
    console.error(body.error_description ?? body.error ?? 'unknown error');
    console.error(
      '\nIf there is no refresh_token but no error either, this account has' +
        ' already granted this client before - revoke it at' +
        ' https://myaccount.google.com/permissions and run this again.'
    );
    process.exit(1);
  }

  const credential = JSON.stringify({
    type: 'authorized_user',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: body.refresh_token,
  });

  console.log('\nDone. Set it with:\n');
  console.log(
    `fly secrets set -a makespace-app GMAIL_AUTHORIZED_USER_JSON='${credential}'\n`
  );
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
