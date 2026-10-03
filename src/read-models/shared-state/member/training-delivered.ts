import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq, inArray, sql} from 'drizzle-orm';
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

// Bulk form of trainingsDeliveredBy for the /areas page: one query for every
// owner's delivery dates across every area's equipment at once, instead of one
// query per owner. `trainersByEquipment` maps each owner's member numbers (the
// owner's current AND past numbers - trainings delivered before a rejoin stay
// filed under the old number) to the equipment scope those numbers apply to.
// Like trainingsDeliveredBy, this excludes legacy imports and returns only
// current trainer-of-record rows.
export const trainingsDeliveredByForAreas =
  (db: BetterSQLite3Database) =>
  (
    trainersByEquipment: ReadonlyArray<{
      trainerMemberNumbers: ReadonlyArray<number>;
      equipmentIds: ReadonlyArray<UUID>;
    }>
  ): ReadonlyArray<{
    trainerMemberNumber: number;
    equipmentId: UUID;
    trainedAt: Date;
  }> => {
    const trainerNumbers = Array.from(
      new Set(trainersByEquipment.flatMap(t => [...t.trainerMemberNumbers]))
    );
    const equipmentIds = Array.from(
      new Set(trainersByEquipment.flatMap(t => [...t.equipmentIds]))
    );
    if (trainerNumbers.length === 0 || equipmentIds.length === 0) {
      return [];
    }
    // (trainer number, equipment) pairs are fanned out in memory after one
    // shared scan; the per-pair filtering below keeps each owner's counts
    // scoped to their own area's machines.
    const equipmentByTrainer = new Map<number, Set<UUID>>();
    for (const scope of trainersByEquipment) {
      for (const number of scope.trainerMemberNumbers) {
        const existing = equipmentByTrainer.get(number) ?? new Set<UUID>();
        scope.equipmentIds.forEach(id => existing.add(id));
        equipmentByTrainer.set(number, existing);
      }
    }
    return db
      .select({
        trainedByMemberNumber: trainedMemberstable.trainedByMemberNumber,
        equipmentId: trainedMemberstable.equipmentId,
        trainedAt: trainedMemberstable.trainedAt,
      })
      .from(trainedMemberstable)
      .where(
        and(
          inArray(trainedMemberstable.trainedByMemberNumber, trainerNumbers),
          inArray(trainedMemberstable.equipmentId, [...equipmentIds]),
          eq(trainedMemberstable.legacyImport, false)
        )
      )
      .all()
      .flatMap(row => {
        if (row.trainedByMemberNumber === null) {
          return [];
        }
        return equipmentByTrainer
          .get(row.trainedByMemberNumber)
          ?.has(row.equipmentId as UUID)
          ? [
              {
                trainerMemberNumber: row.trainedByMemberNumber,
                equipmentId: row.equipmentId as UUID,
                trainedAt: row.trainedAt,
              },
            ]
          : [];
      });
  };

export type QuarterCount = {label: Html; count: number};

// One query for the training dates behind every machine's quarterly sparkline
// at once (the /areas page draws one for each red machine). A row counts
// towards its machine exactly when equipment expansion would have kept it: the
// trainee must resolve to a member with at least one member number, matching
// the member-core lookup the full expansion uses to drop orphan records.
// Legacy-import rows are included here on purpose - the per-equipment
// "trained since" chart has always counted them when the trainee is
// resolvable, unlike the owner-delivery stats below.
export const trainingsForEquipmentBuckets =
  (db: BetterSQLite3Database) =>
  (
    equipmentIds: ReadonlyArray<UUID>
  ): ReadonlyArray<{equipmentId: UUID; trainedAt: Date}> => {
    if (equipmentIds.length === 0) {
      return [];
    }
    return db
      .select({
        equipmentId: trainedMemberstable.equipmentId,
        trainedAt: trainedMemberstable.trainedAt,
      })
      .from(trainedMemberstable)
      // EXISTS, not an inner join: a rejoined member holds several member
      // numbers, and joining on the numbers table would duplicate their
      // training rows (the expansion this replaces counted one row per
      // trainee). One matching number is enough to resolve the trainee.
      .where(
        and(
          inArray(trainedMemberstable.equipmentId, [...equipmentIds]),
          sql`EXISTS (SELECT 1 FROM memberNumbers WHERE memberNumbers.userId = ${trainedMemberstable.userId})`
        )
      )
      .all()
      .map(row => ({
        equipmentId: row.equipmentId as UUID,
        trainedAt: row.trainedAt,
      }));
  };

// Buckets delivery timestamps into the most recent `quarters` quarters, oldest
// first so the current quarter renders on the right. `now` is injected for
// testability. Each timestamp is converted once and bucketed by comparison
// against numeric quarter boundaries, rather than re-deriving boundaries per
// timestamp.
export const trainingsByQuarter = (
  deliveredAt: ReadonlyArray<Date>,
  now: DateTime,
  quarters = 4
): ReadonlyArray<QuarterCount> => {
  const currentQuarterStart = now.startOf('quarter');
  const boundaries = Array.from({length: quarters + 1}, (_unused, i) =>
    currentQuarterStart.minus({quarters: quarters - 1 - i}).toMillis()
  );
  const counts = Array<number>(quarters).fill(0);
  for (const d of deliveredAt) {
    const t = DateTime.fromJSDate(d).toMillis();
    for (let i = 0; i < quarters; i += 1) {
      // Inclusive start, exclusive end - matching the quarter boundaries the
      // page has always shown.
      if (t >= boundaries[i] && t < boundaries[i + 1]) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts.map((count, i) => {
    const start = DateTime.fromMillis(boundaries[i]);
    return {label: html`Q${start.quarter} ${start.year}`, count};
  });
};
