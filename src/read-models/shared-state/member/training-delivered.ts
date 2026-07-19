import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq, inArray} from 'drizzle-orm';
import {DateTime} from 'luxon';
import {UUID} from 'io-ts-types';
import {trainedMemberstable} from '../state';
import { html, Html } from '../../../types/html';

// All timestamps at which a member delivered training to someone (i.e. ran a
// session) on the given equipment, excluding bulk legacy imports.
// `trainerMemberNumbers` should include the owner's current AND past member
// numbers, because trainings delivered before a rejoin stay filed under the old
// `trainedByMemberNumber`. `equipmentIds` scopes the result to a single area's
// equipment - pass that area's equipment.
//
// Caveat: the trainedMembers table holds only the *current* trainer-of-record
// per (trainee, equipment), so a training drops off this list if that trainee is
// later re-trained by someone else. Re-training is rare and usually well after
// the first, so these are a good approximation of trainings delivered - not an
// exact ledger. The full history lives in the event log if we ever need exact
// counts.
export const trainingsDeliveredBy =
  (db: BetterSQLite3Database) =>
  (
    trainerMemberNumbers: ReadonlyArray<number>,
    equipmentIds: ReadonlyArray<UUID>
  ): ReadonlyArray<Date> => {
    if (equipmentIds.length === 0 || trainerMemberNumbers.length === 0) {
      return [];
    }
    return db
      .select({trainedAt: trainedMemberstable.trainedAt})
      .from(trainedMemberstable)
      .where(
        and(
          inArray(trainedMemberstable.trainedByMemberNumber, [
            ...trainerMemberNumbers,
          ]),
          inArray(trainedMemberstable.equipmentId, [...equipmentIds]),
          eq(trainedMemberstable.legacyImport, false)
        )
      )
      .all()
      .map(row => row.trainedAt);
  };

export type QuarterCount = {label: Html; count: number};

// Buckets delivery timestamps into the most recent `quarters` quarters, oldest
// first so the current quarter renders on the right. `now` is injected for
// testability.
export const trainingsByQuarter = (
  deliveredAt: ReadonlyArray<Date>,
  now: DateTime,
  quarters = 4
): ReadonlyArray<QuarterCount> => {
  const currentQuarterStart = now.startOf('quarter');
  return Array.from({length: quarters}, (_unused, i) => {
    const start = currentQuarterStart.minus({quarters: quarters - 1 - i});
    const end = start.plus({quarters: 1});
    const count = deliveredAt.filter(d => {
      const dt = DateTime.fromJSDate(d);
      return dt >= start && dt < end;
    }).length;
    return {label: html`Q${start.quarter} ${start.year}`, count};
  });
};
