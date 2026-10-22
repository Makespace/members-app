import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Actor, constructEvent} from '../../types';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {
  normalisePurchases,
  RawPurchases,
  totalPence,
  typedPurchases,
} from '../../purchasing/purchases';
import {SharedReadModel} from '../../read-models/shared-state';
import {classifyPurchase} from '../../purchasing/classify-purchase';
import {budgetYearOf} from '../../purchasing/budget-year';
import {Command} from '../command';
import {
  normaliseProposal,
  RawProposal,
  typedProposal,
} from '../../purchasing/proposal';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {BuyerRole, canBuyDirectly} from '../../purchasing/buy-directly';
import {
  allMemberNumbers,
  PurchasingArea,
} from '../../read-models/shared-state/return-types';
import {PositivePenceFromPoundsString} from '../../types/money';

// A yes/no radio answer.
const answer = t.union([t.boolean, tt.BooleanFromString]);

const codec = t.strict({
  id: tt.UUID,
  purchasingAreaId: tt.UUID,
  isMemberPaidConsumable: answer,
  affectsOtherAreas: answer,
  // The other areas ticked; one arrives as a string, several as a list.
  affectedAreaIds: t.union([tt.UUID, t.readonlyArray(tt.UUID), t.undefined]),
  healthAndSafetyRisk: answer,
  // Only read when the request needs a proposal.
  proposal: t.union([RawProposal, t.undefined]),
  summary: tt.NonEmptyString,
  // Each shop with the items bought there and any delivery charge; their
  // total decides the outcome. See src/purchasing/purchases.ts. Not needed
  // when buying directly.
  purchases: t.union([RawPurchases, t.undefined]),
  // A super user or the area's purchaser making the purchase themselves;
  // see src/purchasing/buy-directly.ts. Then only what it cost is given.
  buyingDirectly: t.union([answer, t.undefined]),
  amount: t.union([t.string, t.undefined]),
  justification: tt.NonEmptyString,
  // API only: who the request is recorded against when it is entered with
  // the admin token (seeding, or recording one made elsewhere). Ignored for
  // a logged-in member, who always submits as themselves.
  submittedByMemberNumber: t.union([t.number, tt.NumberFromString, t.undefined]),
});

type SubmitPurchaseRequest = t.TypeOf<typeof codec>;

const fail = (message: string) =>
  failureWithStatus(message, StatusCodes.BAD_REQUEST)();

// The other areas it affects, by id and name. Saying it affects others
// means choosing at least one; areas that don't exist are refused.
const affectedAreas = (
  rm: SharedReadModel,
  command: SubmitPurchaseRequest
): E.Either<FailureWithStatus, ReadonlyArray<{id: tt.UUID; name: string}>> => {
  if (!command.affectsOtherAreas) {
    return E.right([]);
  }
  const ids =
    command.affectedAreaIds === undefined
      ? []
      : typeof command.affectedAreaIds === 'string'
        ? [command.affectedAreaIds]
        : [...new Set(command.affectedAreaIds)];
  if (ids.length === 0) {
    return E.left(fail('Please choose which other areas it affects.'));
  }
  return pipe(
    ids,
    E.traverseArray(id =>
      pipe(
        rm.area.get(id),
        O.map(area => ({id, name: area.name})),
        E.fromOption(() => fail('One of the other areas chosen no longer exists.'))
      )
    )
  );
};

const submitterMemberNumber = (
  actor: Actor,
  onBehalfOf: number | undefined
) => {
  if (actor.tag === 'user') {
    return E.right(actor.user.memberNumber);
  }
  if (actor.tag === 'token' && onBehalfOf !== undefined) {
    return E.right(onBehalfOf);
  }
  return E.left(
    fail(
      'Purchase requests must be submitted by a logged-in member, or through the API on behalf of one (submittedByMemberNumber).'
    )
  );
};

// Who is sending it, as far as buying directly goes. The admin API counts as
// a super user.
const buyerRole = (
  rm: SharedReadModel,
  actor: Actor,
  purchasingArea: PurchasingArea
): BuyerRole => {
  if (isAdminOrSuperUser({actor, rm})) {
    return 'super-user';
  }
  return actor.tag === 'user' &&
    purchasingArea.purchasers.some(purchaser =>
      allMemberNumbers(purchaser).includes(actor.user.memberNumber)
    )
    ? 'purchaser'
    : 'neither';
};

// What it cost when bought directly: the amount given, in pounds.
const directAmount = (amount: string | undefined) =>
  pipe(
    PositivePenceFromPoundsString.decode(amount ?? ''),
    E.mapLeft(() => fail('Please give what it cost, in pounds, e.g. 42.50.'))
  );

// The outcome is always worked out here, from the answer, the itemised total
// (the sum of the shop costs) and this year's budget figures, whatever the
// page may have shown.
const process: Command<SubmitPurchaseRequest>['process'] = input => {
  const {command, rm} = input;
  if (O.isSome(rm.purchasing.getRequest(command.id))) {
    // Already recorded - most likely the form was submitted twice.
    return TE.right(O.none);
  }
  const now = new Date();
  return pipe(
    E.Do,
    E.bind('submittedByMemberNumber', () =>
      submitterMemberNumber(command.actor, command.submittedByMemberNumber)
    ),
    E.bind('purchasingArea', () =>
      pipe(
        rm.purchasing.get(command.purchasingAreaId, now),
        E.fromOption(() =>
          failureWithStatus(
            'The requested purchasing area does not exist',
            StatusCodes.NOT_FOUND
          )()
        )
      )
    ),
    E.let('boughtDirectly', () => command.buyingDirectly === true),
    E.bind('purchases', ({boughtDirectly}) =>
      boughtDirectly
        ? E.right([])
        : pipe(
            normalisePurchases(typedPurchases(command.purchases)),
            E.mapLeft(fail)
          )
    ),
    E.bind('totalPence', ({boughtDirectly, purchases}) =>
      boughtDirectly ? directAmount(command.amount) : E.right(totalPence(purchases))
    ),
    E.bind('affected', () => affectedAreas(rm, command)),
    E.let('classification', ({purchasingArea, totalPence, affected}) =>
      classifyPurchase({
        affectedAreaNames: affected.map(area => area.name),
        healthAndSafetyRisk: command.healthAndSafetyRisk,
        isMemberPaidConsumable: command.isMemberPaidConsumable,
        amountPence: totalPence,
        yearlyBudgetPence: purchasingArea.yearlyBudgetPence,
        spentThisYearPence: purchasingArea.spentThisYearPence,
      })
    ),
    E.tap(({boughtDirectly, purchasingArea, affected, classification}) =>
      boughtDirectly
        ? pipe(
            canBuyDirectly(buyerRole(rm, command.actor, purchasingArea), {
              affectedAreaNames: affected.map(area => area.name),
              healthAndSafetyRisk: command.healthAndSafetyRisk,
              classification,
            }),
            E.mapLeft(message =>
              failureWithStatus(message, StatusCodes.FORBIDDEN)()
            )
          )
        : E.right(true)
    ),
    // A request that needs a proposal must come with one; any other ignores
    // whatever proposal fields were sent. Buying directly never has one: it
    // is only allowed when none is needed, or by a super user when the cost
    // alone would need one.
    E.bind('proposal', ({classification, boughtDirectly}) =>
      classification.approval === 'proposal' && !boughtDirectly
        ? pipe(
            normaliseProposal(
              typedProposal(command.proposal),
              command.healthAndSafetyRisk
            ),
            E.mapLeft(fail)
          )
        : E.right(null)
    ),
    E.map(
      ({
        submittedByMemberNumber,
        purchasingArea,
        classification,
        purchases,
        totalPence,
        affected,
        proposal,
        boughtDirectly,
      }) =>
        O.some(
          constructEvent('PurchaseRequestSubmitted')({
            id: command.id,
            purchasingAreaId: purchasingArea.id,
            submittedByMemberNumber,
            summary: command.summary.trim(),
            totalPence,
            purchases,
            justification: command.justification.trim(),
            isMemberPaidConsumable: command.isMemberPaidConsumable,
            affectedAreaIds: affected.map(area => area.id),
            healthAndSafetyRisk: command.healthAndSafetyRisk,
            proposal,
            outcome: classification.outcome,
            approval: classification.approval,
            outcomeReason: classification.reason,
            budgetYear: budgetYearOf(now),
            yearlyBudgetPence: purchasingArea.yearlyBudgetPence,
            spentThisYearPence: purchasingArea.spentThisYearPence,
            boughtDirectly,
            actor: command.actor,
          })
        )
    ),
    TE.fromEither
  );
};

// Any logged-in member can request a purchase; it then waits for a super
// user to approve it. The admin API can submit on a member's behalf. Who
// may buy directly is checked with the rest of the request, above.
const isAuthorized: Command<SubmitPurchaseRequest>['isAuthorized'] = ({
  actor,
  rm,
}) => actor.tag === 'user' || isAdminOrSuperUser({actor, rm});

export const submit: Command<SubmitPurchaseRequest> = {
  process,
  decode: codec.decode,
  isAuthorized,
};
