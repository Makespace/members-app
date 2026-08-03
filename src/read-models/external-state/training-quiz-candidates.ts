import * as O from 'fp-ts/Option';
import * as crypto from 'crypto';
import {pipe} from 'fp-ts/lib/function';
import {inArray} from 'drizzle-orm';
import {UUID} from 'io-ts-types';
import {ReadonlyRecord} from 'fp-ts/ReadonlyRecord';
import {EmailAddress, EmailAddressCodec} from '../../types';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {sheetDataTable} from '../../sync-worker/google/sheet-data-table';

// The event we would create from one cached quiz row. This is the shape a
// future `TrainingQuizCompleted` domain event / `RecordTrainingQuizCompletion`
// command will use; for now it only drives the read-only dry-run page.
export type CandidateTrainingQuizCompleted = {
  equipmentId: UUID;
  sheetId: string;
  completedAt: Date; // the historical completion time (goes in the event, not recordedAt)
  email: O.Option<EmailAddress>;
  memberNumber: O.Option<number>;
  score: number;
  maxScore: number;
  rowHash: string; // stable dedup key
};

// The fields are joined with \u0001 (an ASCII control byte that can never
// appear in a field value), making the concatenation unambiguous. Never change
// this: it changes every rowHash, and previously imported rows would all be
// re-imported as duplicates.
const SEP = '\u0001';

// Stable hash of the identifying fields of a quiz row, used to dedup: the same
// row always hashes the same, while a retake (different timestamp/score) hashes
// differently. Reproducible from both the migration and the going-forward sync.
const hashQuizRow = (input: {
  sheetId: string;
  completedAt: Date;
  email: O.Option<string>;
  memberNumber: O.Option<number>;
  score: number;
  maxScore: number;
}): string =>
  crypto
    .createHash('sha256')
    .update(
      [
        input.sheetId,
        input.completedAt.getTime().toString(),
        pipe(
          input.email,
          O.map(e => e.trim().toLowerCase()),
          O.getOrElse(() => '')
        ),
        pipe(
          input.memberNumber,
          O.map(String),
          O.getOrElse(() => '')
        ),
        input.score.toString(),
        input.maxScore.toString(),
      ].join(SEP)
    )
    .digest('hex');

// Reads the cached quiz rows (sheet_data) and maps each to the event that would
// be created. Rows whose sheet is not (any longer) mapped to an equipment are
// skipped. Read-only - no events are written.
export const getTrainingQuizCandidates =
  (extDB: ExternalStateDB) =>
  async (
    sheetToEquipment: ReadonlyRecord<string, UUID>
  ): Promise<ReadonlyArray<CandidateTrainingQuizCompleted>> => {
    const sheetIds = Object.keys(sheetToEquipment);
    if (sheetIds.length === 0) {
      return [];
    }
    const rows = await extDB
      .select()
      .from(sheetDataTable)
      .where(inArray(sheetDataTable.sheet_id, sheetIds));

    return rows.flatMap(row => {
      const equipmentId = sheetToEquipment[row.sheet_id];
      if (equipmentId === undefined) {
        return [];
      }
      // Freeform sheet input: validate it as a real address rather than
      // trusting the brand. An invalid value becomes O.none (and hashes as an
      // empty email segment), matching how the real event reader will treat it.
      const email = pipe(
        O.fromNullable(row.email_provided),
        O.chain(e => O.fromEither(EmailAddressCodec.decode(e)))
      );
      const memberNumber = O.fromNullable(row.member_number_provided);
      return [
        {
          equipmentId,
          sheetId: row.sheet_id,
          completedAt: row.response_submitted,
          email,
          memberNumber,
          score: row.score,
          maxScore: row.max_score,
          rowHash: hashQuizRow({
            sheetId: row.sheet_id,
            completedAt: row.response_submitted,
            email,
            memberNumber,
            score: row.score,
            maxScore: row.max_score,
          }),
        },
      ];
    });
  };
