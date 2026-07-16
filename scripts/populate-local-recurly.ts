#!/usr/bin/env npx tsx
import {createClient} from '@libsql/client';

// Seeds the local external-state DB with Recurly subscription rows so the
// /areas active-vs-inactive owner split can be exercised locally WITHOUT a real
// RECURLY_TOKEN (which the dev environment doesn't have, so the table is
// otherwise empty and every owner shows as "No recent Recurly data").
//
// Emails below match owners created by scripts/populate-local-dev.sh.
// Run it inside the app container (it needs access to the DB volume):
//   docker compose ... cp ./scripts/populate-local-recurly.ts app:/app/populate-local-recurly.ts
//   docker compose ... exec app npx tsx /app/populate-local-recurly.ts
// Edit the `seed` list to try other reason combinations.

const url = process.env.GOOGLE_DB_URL ?? 'file:/db/makespace-member-app-google.db';

type Flags = Partial<{
  hasActiveSubscription: boolean;
  hasFutureSubscription: boolean;
  hasCanceledSubscription: boolean;
  hasPausedSubscription: boolean;
  hasPastDueInvoice: boolean;
}>;

const seed: Array<{email: string} & Flags> = [
  // Active -> appears in the main "active owners" table.
  {email: 'owner@example.com', hasActiveSubscription: true},
  // Cancelled-but-still-in-term AND past-due -> inactive, shows two chips.
  {
    email: 'trainer@example.com',
    hasActiveSubscription: true,
    hasCanceledSubscription: true,
    hasPastDueInvoice: true,
  },
];

const b = (v?: boolean) => (v ? 1 : 0);

const main = async () => {
  const client = createClient({url});

  // Self-sufficient: create the table if the sync worker hasn't yet.
  await client.execute(`
    CREATE TABLE IF NOT EXISTS recurly_subscriptions (
      email TEXT PRIMARY KEY,
      cacheLastUpdated INTEGER NOT NULL,
      hasActiveSubscription INTEGER NOT NULL,
      hasFutureSubscription INTEGER NOT NULL,
      hasCanceledSubscription INTEGER NOT NULL,
      hasPausedSubscription INTEGER NOT NULL,
      hasPastDueInvoice INTEGER NOT NULL
    );
  `);

  for (const s of seed) {
    await client.execute({
      sql: `
        INSERT INTO recurly_subscriptions
          (email, cacheLastUpdated, hasActiveSubscription, hasFutureSubscription,
           hasCanceledSubscription, hasPausedSubscription, hasPastDueInvoice)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          cacheLastUpdated = excluded.cacheLastUpdated,
          hasActiveSubscription = excluded.hasActiveSubscription,
          hasFutureSubscription = excluded.hasFutureSubscription,
          hasCanceledSubscription = excluded.hasCanceledSubscription,
          hasPausedSubscription = excluded.hasPausedSubscription,
          hasPastDueInvoice = excluded.hasPastDueInvoice
      `,
      args: [
        s.email,
        Date.now(),
        b(s.hasActiveSubscription),
        b(s.hasFutureSubscription),
        b(s.hasCanceledSubscription),
        b(s.hasPausedSubscription),
        b(s.hasPastDueInvoice),
      ],
    });
    console.log(`seeded recurly row for ${s.email}`);
  }
  console.log('Done. Reload /areas to see the split.');
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
