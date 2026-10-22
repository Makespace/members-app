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
  purchasingAreaSpendTable,
  purchasingAreasTable,
  purchasingAreaYearBudgetsTable,
} from '../state';
import {getMemberCoreByUserId} from '../member/get';
import {
  PurchaseRequest,
  PurchasingArea,
  PurchasingAreaPurchaser,
  PurchasingAreaSummary,
  RecordedSpend,
} from '../return-types';
import {
  budgetYearOf,
  countsAgainstBudget,
} from '../../../purchasing/budget-year';
import {UserId} from '../../../types';
import {PurchaseCodec} from '../../../purchasing/purchases';
import {ProposalCodec} from '../../../purchasing/proposal';

// This year's requests that would come out of the budget, by status: those
// approved or bought directly count as spent; those awaiting approval are
// shown apart.
const budgetRequestsInYear =
  (db: BetterSQLite3Database) =>
  (purchasingAreaId: UUID, budgetYear: number) => {
    const rows = db
      .select({
        amountPence: purchaseRequestsTable.totalPence,
        outcome: purchaseRequestsTable.outcome,
        status: purchaseRequestsTable.status,
      })
      .from(purchaseRequestsTable)
      .where(
        and(
          eq(purchaseRequestsTable.purchasingAreaId, purchasingAreaId),
          eq(purchaseRequestsTable.budgetYear, budgetYear)
        )
      )
      .all()
      .filter(row => countsAgainstBudget(row.outcome));
    const totalWith = (status: string) =>
      rows
        .filter(row => row.status === status)
        .reduce((total, row) => total + row.amountPence, 0);
    return {
      approvedPence: totalWith('approved') + totalWith('bought-directly'),
      awaitingApprovalPence: totalWith('awaiting-approval'),
    };
  };

const getYearBudget =
  (db: BetterSQLite3Database) =>
  (purchasingAreaId: UUID, budgetYear: number): O.Option<number> =>
    pipe(
      db
        .select({yearlyBudgetPence: purchasingAreaYearBudgetsTable.yearlyBudgetPence})
        .from(purchasingAreaYearBudgetsTable)
        .where(
          and(
            eq(purchasingAreaYearBudgetsTable.purchasingAreaId, purchasingAreaId),
            eq(purchasingAreaYearBudgetsTable.budgetYear, budgetYear)
          )
        )
        .get(),
      O.fromNullable,
      O.map(row => row.yearlyBudgetPence)
    );

const getRecordedSpend =
  (db: BetterSQLite3Database) =>
  (purchasingAreaId: UUID, budgetYear: number): ReadonlyArray<RecordedSpend> =>
    db
      .select({
        id: purchasingAreaSpendTable.id,
        amountPence: purchasingAreaSpendTable.amountPence,
        description: purchasingAreaSpendTable.description,
        kind: purchasingAreaSpendTable.kind,
        recordedAt: purchasingAreaSpendTable.recordedAt,
      })
      .from(purchasingAreaSpendTable)
      .where(
        and(
          eq(purchasingAreaSpendTable.purchasingAreaId, purchasingAreaId),
          eq(purchasingAreaSpendTable.budgetYear, budgetYear)
        )
      )
      .orderBy(asc(purchasingAreaSpendTable.recordedAt))
      .all();

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
    const recordedSpend = getRecordedSpend(db)(row.id, budgetYear);
    const recordedOfKind = (kind: RecordedSpend['kind']) =>
      recordedSpend
        .filter(spend => spend.kind === kind)
        .reduce((total, spend) => total + spend.amountPence, 0);
    const requests = budgetRequestsInYear(db)(row.id, budgetYear);
    const spentThisYearPence = requests.approvedPence + recordedOfKind('budget');
    const yearlyBudgetPence = pipe(
      getYearBudget(db)(row.id, budgetYear),
      O.getOrElse(() => row.yearlyBudgetPence)
    );
    return {
      id: row.id,
      name: row.name,
      yearlyBudgetPence,
      usualBudgetPence: row.yearlyBudgetPence,
      recordedSpend,
      approvedSpendThisYearPence: recordedOfKind('approved'),
      awaitingApprovalPence: requests.awaitingApprovalPence,
      areas,
      purchasers: getPurchasersOf(db)(
        row.id,
        areas.map(area => area.id)
      ),
      budgetYear,
      spentThisYearPence,
      remainingPence: yearlyBudgetPence - spentThisYearPence,
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

const StoredAreaIds = t.readonlyArray(UUID);

const toPurchaseRequest = ({
  purchasesJson,
  affectedAreaIdsJson,
  proposalJson,
  decidedAt,
  decidedByMemberNumber,
  declineReason,
  ...row
}: typeof purchaseRequestsTable.$inferSelect): PurchaseRequest => ({
  ...row,
  decidedAt: O.fromNullable(decidedAt),
  decidedByMemberNumber: O.fromNullable(decidedByMemberNumber),
  declineReason: O.fromNullable(declineReason),
  proposal: pipe(
    O.fromNullable(proposalJson),
    O.chain(json => O.fromEither(ProposalCodec.decode(JSON.parse(json))))
  ),
  affectedAreaIds: pipe(
    StoredAreaIds.decode(JSON.parse(affectedAreaIdsJson)),
    E.getOrElse((): t.TypeOf<typeof StoredAreaIds> => [])
  ),
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

// Every purchase request, newest first.
export const getAllPurchaseRequests =
  (db: BetterSQLite3Database) => (): ReadonlyArray<PurchaseRequest> =>
    db
      .select()
      .from(purchaseRequestsTable)
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
