#!/usr/bin/env bun
import axios from 'axios';
import open from 'open';

/**
 * An easy way to log into the dev server as a given user.
 */

const SITE = 'http://localhost:8080';
const MAIL = 'http://localhost:1080';

interface Email {
  id: string;
}

async function getAllMail(): Promise<Email[]> {
  const {data} = await axios.get<Email[]>(`${MAIL}/messages`);
  return data;
}

async function waitForNextMail(previously: Email[]): Promise<Email> {
  for (;;) {
    const messages = await getAllMail();
    if (previously.length < messages.length) {
      return messages[messages.length - 1];
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

async function main() {
  if (process.argv.length !== 3) {
    console.error('usage: ./scripts/login.ts NAME');
    console.error('');
    console.error('Log in as NAME@example.com on the dev server.');
    return 1;
  }

  const name = process.argv[2];
  const email = `${name}@example.com`;

  const priorMail = await getAllMail();

  await axios.post(
    `${SITE}/auth`,
    {
      email,
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const mail = await waitForNextMail(priorMail);
  const {data} = await axios.get<string>(`${MAIL}/messages/${mail.id}.html`);
  const re = new RegExp('href="([^"]*/auth[^"]*)"');
  const m = data.match(re);
  if (m) {
    const loginUrl = m[1];
    await open(loginUrl);
  } else {
    console.error('Could not find login URL in email.');
    return 1;
  }
  return 0;
}

void (async () => {
  const exitCode = await main();
  process.exitCode = exitCode;
})();
