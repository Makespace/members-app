#!/usr/bin/env bun
import recurly from 'recurly';
import {loadConfig} from '../src/configuration';

/**
 * Generate a report of all active Recurly subscribers with their email addresses.
 *
 * Usage:
 *   ./scripts/recurly-active-subscribers.ts [--csv]
 *
 * Options:
 *   --csv    Output in CSV format (email,account_code)
 */

interface ActiveSubscriber {
  email: string;
  accountCode: string;
  accountId: string;
}

async function getActiveSubscribers(
  recurlyToken: string
): Promise<ActiveSubscriber[]> {
  const client = new recurly.Client(recurlyToken);
  const activeSubscribers: ActiveSubscriber[] = [];

  console.error('Fetching accounts from Recurly...');

  const accounts = client.listAccounts();
  let count = 0;

  for await (const account of accounts.each()) {
    count++;
    if (count % 100 === 0) {
      console.error(`Processed ${count} accounts...`);
    }

    if (account.hasActiveSubscription && account.email) {
      activeSubscribers.push({
        email: account.email,
        accountCode: account.code ?? '',
        accountId: account.id ?? '',
      });
    }
  }

  console.error(`Total accounts processed: ${count}`);
  console.error(`Active subscribers found: ${activeSubscribers.length}`);

  return activeSubscribers;
}

async function main(): Promise<number> {
  const config = loadConfig();

  if (!config.RECURLY_TOKEN) {
    console.error('Error: RECURLY_TOKEN is not configured');
    console.error('Set the RECURLY_TOKEN environment variable and try again.');
    return 1;
  }

  const outputCsv = process.argv.includes('--csv');

  try {
    const subscribers = await getActiveSubscribers(config.RECURLY_TOKEN);

    if (outputCsv) {
      console.log('email,account_code,account_id');
      for (const sub of subscribers) {
        console.log(`${sub.email},${sub.accountCode},${sub.accountId}`);
      }
    } else {
      console.log('\nActive Subscribers:');
      console.log('===================\n');
      for (const sub of subscribers) {
        console.log(
          `${sub.email.padEnd(40)} (code: ${sub.accountCode}, id: ${sub.accountId})`
        );
      }
      console.log(`\nTotal: ${subscribers.length} active subscribers`);
    }

    return 0;
  } catch (error) {
    console.error('Error fetching Recurly data:', error);
    return 1;
  }
}

void (async () => {
  const exitCode = await main();
  process.exitCode = exitCode;
})();
