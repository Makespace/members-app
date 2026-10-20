import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, asc, desc, eq, inArray, sql} from 'drizzle-orm';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {
  areasTable,
  ownersTable,
  purchaseRequestsTable,
  purchasersTable,
  purchasingAreaAreasTable,
  purchasingAreasTable,
} from '../state';
import {getMemberCoreByUserId} from '../member/get';
import {
  PurchaseRequest,
  PurchasingArea,
  PurchasingAreaPurchaser,
  PurchasingAreaSummary,
} from '../return-types';
import {
  budgetYearOf,
  countsAgainstBudget,
} from '../../../purchasing/budget-year';
import {UserId} from '../../../types';
import {PurchaseCodec} from '../../../purchasing/purchases';

const spentInYear =
  (db: BetterSQLite3Database) =>
  (purchasingAreaId: UUID, budgetYear: number): number =>
    db
      .select({
        amountPence: purchaseRequestsTable.totalPence,
        outcome: purchaseRequestsTable.outcome,
      })
      .from(purchaseRequestsTable)
      .where(
        and(
          eq(purchaseRequestsTable.purchasingAreaId, purchasingAreaId),
          eq(purchaseRequestsTable.budgetYear, budgetYear)
        )
      )
      .all()
      .filter(row => countsAgainstBudget(row.outcome))
      .reduce((total, row) => total + row.amountPence, 0);

const getAreasOf =
  (db: BetterSQLite3Database) =>
  (purchasingAreaId: UUID): PurchasingArea['areas'] =>
    db
      .select({id: areasTable.id, name: areasTable.name})
      .from(purchasingAreaAreasTable)
      .innerJoin(areasTable, eq(areasTable.id, purchasingAreaAreasTable.areaId))
      .where(eq(purchasingAreaAreasTable.purchasingAreaId, purchasingAreaId))
      .orderBy(asc(areasTable.name))
      .all()
      .map(row => ({id: row.id as UUID, name: row.name}));

const ownsAnyOf =
  (db: BetterSQLite3Database) =>
  (userId: UserId, areaIds: ReadonlyArray<UUID>): boolean =>
    areaIds.length > 0 &&
    db
      .select({areaId: ownersTable.areaId})
      .from(ownersTable)
      .where(
        and(
          eq(ownersTable.userId, userId),
          inArray(ownersTable.areaId, [...areaIds])
        )
      )
      .get() !== undefined;

const getPurchasersOf =
  (db: BetterSQLite3Database) =>
  (
    purchasingAreaId: UUID,
    areaIds: ReadonlyArray<UUID>
  ): ReadonlyArray<PurchasingAreaPurchaser> =>
    pipe(
      db
        .select()
        .from(purchasersTable)
        .where(eq(purchasersTable.purchasingAreaId, purchasingAreaId))
        .orderBy(asc(purchasersTable.addedAt))
        .all(),
      RA.filterMap(row =>
        pipe(
          getMemberCoreByUserId(db)(row.userId),
          O.map(member => ({
            userId: member.userId,
            memberNumber: member.memberNumber,
            pastMemberNumbers: member.pastMemberNumbers,
            name: member.name,
            primaryEmailAddress: member.primaryEmailAddress,
            addedAt: row.addedAt,
            isOwnerOfAnArea: ownsAnyOf(db)(member.userId, areaIds),
          }))
        )
      )
    );

const expand =
  (db: BetterSQLite3Database, now: Date) =>
  (row: typeof purchasingAreasTable.$inferSelect): PurchasingArea => {
    const budgetYear = budgetYearOf(now);
    const areas = getAreasOf(db)(row.id);
    const spentThisYearPence = spentInYear(db)(row.id, budgetYear);
    return {
      id: row.id,
      name: row.name,
      yearlyBudgetPence: row.yearlyBudgetPence,
      areas,
      purchasers: getPurchasersOf(db)(
        row.id,
        areas.map(area => area.id)
      ),
      budgetYear,
      spentThisYearPence,
      remainingPence: row.yearlyBudgetPence - spentThisYearPence,
    };
  };

// Budget figures are for the budget year containing `now`.
export const getPurchasingArea =
  (db: BetterSQLite3Database) =>
  (id: UUID, now: Date): O.Option<PurchasingArea> =>
    pipe(
      db
        .select()
        .from(purchasingAreasTable)
        .where(eq(purchasingAreasTable.id, id))
        .get(),
      O.fromNullable,
      O.map(expand(db, now))
    );

export const getAllPurchasingAreas =
  (db: BetterSQLite3Database) =>
  (now: Date): ReadonlyArray<PurchasingArea> =>
    db
      .select()
      .from(purchasingAreasTable)
      .orderBy(asc(purchasingAreasTable.name))
      .all()
      .map(expand(db, now));

// The purchasing areas a member is a purchaser for, under any of their
// member numbers. Super users may submit for any purchasing area; that is an
// authorisation rule, so it is applied by callers rather than here.
export const getPurchasingAreasForPurchaser =
  (db: BetterSQLite3Database) =>
  (userId: UserId, now: Date): ReadonlyArray<PurchasingArea> =>
    db
      .select({purchasingArea: purchasingAreasTable})
      .from(purchasersTable)
      .innerJoin(
        purchasingAreasTable,
        eq(purchasingAreasTable.id, purchasersTable.purchasingAreaId)
      )
      .where(eq(purchasersTable.userId, userId))
      .orderBy(asc(purchasingAreasTable.name))
      .all()
      .map(row => expand(db, now)(row.purchasingArea));

// Every area's purchasing area in one query, for pages listing all areas.
export const getAllAreaAssignments = (
  db: BetterSQLite3Database
): ReadonlyArray<{areaId: UUID} & PurchasingAreaSummary> =>
  db
    .select({
      areaId: purchasingAreaAreasTable.areaId,
      id: purchasingAreasTable.id,
      name: purchasingAreasTable.name,
    })
    .from(purchasingAreaAreasTable)
    .innerJoin(
      purchasingAreasTable,
      eq(purchasingAreasTable.id, purchasingAreaAreasTable.purchasingAreaId)
    )
    .all();

export const getPurchasingAreaForArea =
  (db: BetterSQLite3Database) =>
  (areaId: UUID): O.Option<PurchasingAreaSummary> =>
    pipe(
      db
        .select({id: purchasingAreasTable.id, name: purchasingAreasTable.name})
        .from(purchasingAreaAreasTable)
        .innerJoin(
          purchasingAreasTable,
          eq(purchasingAreasTable.id, purchasingAreaAreasTable.purchasingAreaId)
        )
        .where(eq(purchasingAreaAreasTable.areaId, areaId))
        .get(),
      O.fromNullable
    );

const StoredPurchases = t.readonlyArray(PurchaseCodec);

const toPurchaseRequest = ({
  purchasesJson,
  ...row
}: typeof purchaseRequestsTable.$inferSelect): PurchaseRequest => ({
  ...row,
  purchases: pipe(
    StoredPurchases.decode(JSON.parse(purchasesJson)),
    E.getOrElse((): t.TypeOf<typeof StoredPurchases> => [])
  ),
});

// Newest first.
export const getPurchaseRequests =
  (db: BetterSQLite3Database) =>
  (
    purchasingAreaId: UUID,
    budgetYear: number
  ): ReadonlyArray<PurchaseRequest> =>
    db
      .select()
      .from(purchaseRequestsTable)
      .where(
        and(
          eq(purchaseRequestsTable.purchasingAreaId, purchasingAreaId),
          eq(purchaseRequestsTable.budgetYear, budgetYear)
        )
      )
      // rowid breaks ties between requests recorded in the same millisecond.
      .orderBy(desc(purchaseRequestsTable.submittedAt), sql`rowid desc`)
      .all()
      .map(toPurchaseRequest);

export const getPurchaseRequest =
  (db: BetterSQLite3Database) =>
  (id: UUID): O.Option<PurchaseRequest> =>
    pipe(
      db
        .select()
        .from(purchaseRequestsTable)
        .where(eq(purchaseRequestsTable.id, id))
        .get(),
      O.fromNullable,
      O.map(toPurchaseRequest)
    );
