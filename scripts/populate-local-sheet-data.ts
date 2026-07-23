#!/usr/bin/env npx tsx
import {createClient} from '@libsql/client';
import * as fs from 'fs';

// Seeds the local external-state `sheet_data` cache from a downloaded quiz CSV,
// so the /training-event-log dry-run page has data without the Google sync
// (which needs credentials we don't have locally).
//
// Run inside the app container (the DB lives in the container volume):
//   docker compose ... cp <csv> app:/app/quiz.csv
//   docker compose ... cp ./scripts/populate-local-sheet-data.ts app:/app/
//   docker compose ... exec app npx tsx /app/populate-local-sheet-data.ts /app/quiz.csv <sheet-id>
//
// <sheet-id> should match an equipment's trainingSheetId so the page can map
// rows to equipment (e.g. the Metal Lathe sheet id from populate-local-dev.sh).
//
// Note: only the first 5 columns (Timestamp, Email, Score, Name, Membership
// number) are read; the quiz-answer columns are ignored. A naive comma split is
// fine because those five columns never contain embedded commas.

const url =
  process.env.GOOGLE_DB_URL ?? 'file:/db/makespace-member-app-google.db';
const [, , csvPath, sheetId] = process.argv;

if (!csvPath || !sheetId) {
  console.error(
    'usage: npx tsx populate-local-sheet-data.ts <csv-path> <sheet-id>'
  );
  process.exit(1);
}

const parseTimestamp = (s: string): number | null => {
  const m = s
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, MM, yyyy, HH, mm, ss] = m;
  return new Date(
    Number(yyyy),
    Number(MM) - 1,
    Number(dd),
    Number(HH),
    Number(mm),
    Number(ss)
  ).getTime();
};

const parseScore = (s: string): {score: number; max: number} | null => {
  const m = s.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  return {score: Number(m[1]), max: Number(m[2])};
};

const main = async () => {
  const client = createClient({url});
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sheet_data (
      sheet_id TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      response_submitted INTEGER NOT NULL,
      member_number_provided INTEGER,
      email_provided TEXT,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      cached_at INTEGER NOT NULL
    );
  `);
  // Idempotent for this sheet.
  await client.execute({
    sql: 'DELETE FROM sheet_data WHERE sheet_id = ?',
    args: [sheetId],
  });

  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
  let inserted = 0;
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const f = line.split(',');
    const ts = parseTimestamp(f[0] ?? '');
    const sc = parseScore(f[2] ?? '');
    if (ts === null || sc === null) {
      skipped++;
      continue;
    }
    const email = (f[1] ?? '').trim() || null;
    const memberRaw = (f[4] ?? '').trim();
    const memberNumber = /^\d+$/.test(memberRaw) ? Number(memberRaw) : null;
    const percentage = Math.round((sc.score / sc.max) * 100);
    await client.execute({
      sql: `INSERT INTO sheet_data
        (sheet_id, sheet_name, row_index, response_submitted,
         member_number_provided, email_provided, score, max_score, percentage, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sheetId,
        'Form responses 1',
        i,
        ts,
        memberNumber,
        email,
        sc.score,
        sc.max,
        percentage,
        Date.now(),
      ],
    });
    inserted++;
  }
  console.log(
    `Inserted ${inserted} rows for sheet ${sheetId} (skipped ${skipped}).`
  );
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
