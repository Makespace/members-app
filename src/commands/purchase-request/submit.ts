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
  PenceFromPoundsString,
  PositivePenceFromPoundsString,
} from '../../types/money';
import {SharedReadModel} from '../../read-models/shared-state';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';
import {classifyPurchase} from '../../purchasing/classify-purchase';
import {budgetYearOf} from '../../purchasing/budget-year';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

// A yes/no radio answer.
const answer = t.union([t.boolean, tt.BooleanFromString]);

// One shop or website, as typed into the form. The page offers a fixed number
// of blank entries (more with JavaScript), so entirely blank ones are
// ignored. Posted as purchases[0][shop] etc., which Express reads as an array
// - or as an object keyed by index once there are more than 20.
const rawPurchase = t.partial({
  shop: t.string,
  link: t.string,
  items: t.string,
  // In pounds, e.g. "42.50"; optional.
  cost: t.string,
});
const rawPurchases = t.union([
  t.readonlyArray(rawPurchase),
  t.record(t.string, rawPurchase),
]);

const codec = t.strict({
  id: tt.UUID,
  purchasingAreaId: tt.UUID,
  // The estimated total in pounds, e.g. "630.00"; recorded in pence. The
  // outcome, and the budget, are worked out from this.
  estimatedAmount: PositivePenceFromPoundsString,
  isMemberPaidConsumable: answer,
  summary: tt.NonEmptyString,
  purchases: rawPurchases,
  justification: tt.NonEmptyString,
});

type SubmitPurchaseRequest = t.TypeOf<typeof codec>;

type Purchase = {
  shop: string;
  link: string | null;
  items: string;
  costPence: number | null;
};

const fail = (message: string) =>
  failureWithStatus(message, StatusCodes.BAD_REQUEST)();

// Optional. A bare "example.com/thing" is taken to mean https; anything that
// still isn't a web address is refused rather than stored as a broken link.
const normaliseLink = (
  raw: string,
  where: string
): E.Either<FailureWithStatus, string | null> => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return E.right(null);
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const refused = E.left(
    fail(`${where}: the link must be a web address (http or https).`)
  );
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? E.right(url.toString())
      : refused;
  } catch {
    return refused;
  }
};

const normaliseCost = (
  raw: string,
  where: string
): E.Either<FailureWithStatus, number | null> =>
  raw.trim() === ''
    ? E.right(null)
    : pipe(
        PenceFromPoundsString.decode(raw),
        E.mapLeft(() =>
          fail(`${where}: the cost should be in pounds, e.g. 42.50.`)
        )
      );

const normalisePurchase = (
  raw: t.TypeOf<typeof rawPurchase>,
  where: string
): E.Either<FailureWithStatus, O.Option<Purchase>> => {
  const shop = (raw.shop ?? '').trim();
  const items = (raw.items ?? '').trim();
  const link = raw.link ?? '';
  const cost = raw.cost ?? '';
  if (shop === '' && items === '' && link.trim() === '' && cost.trim() === '') {
    return E.right(O.none);
  }
  if (shop === '') {
    return E.left(fail(`${where}: please say which shop or website.`));
  }
  if (items === '') {
    return E.left(fail(`${where}: please list what to buy from ${shop}.`));
  }
  return pipe(
    E.Do,
    E.bind('link', () => normaliseLink(link, shop)),
    E.bind('costPence', () => normaliseCost(cost, shop)),
    E.map(({link, costPence}) => O.some({shop, link, items, costPence}))
  );
};

// Blank entries dropped; at least one shop is required.
const normalisePurchases = (
  raw: t.TypeOf<typeof rawPurchases>
): E.Either<FailureWithStatus, ReadonlyArray<Purchase>> => {
  const entries = Array.isArray(raw)
    ? (raw as ReadonlyArray<t.TypeOf<typeof rawPurchase>>)
    : Object.entries(raw)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, entry]) => entry);
  const purchases: Purchase[] = [];
  for (const [index, entry] of entries.entries()) {
    const normalised = normalisePurchase(entry, `Shop ${index + 1}`);
    if (E.isLeft(normalised)) {
      return normalised;
    }
    if (O.isSome(normalised.right)) {
      purchases.push(normalised.right.value);
    }
  }
  return purchases.length === 0
    ? E.left(fail('Please add at least one shop or website to buy from.'))
    : E.right(purchases);
};

const submitterMemberNumber = (actor: Actor) =>
  actor.tag === 'user'
    ? E.right(actor.user.memberNumber)
    : E.left(fail('Purchase requests must be submitted by a logged-in member.'));

const isPurchaserFor = (
  rm: SharedReadModel,
  memberNumber: number,
  purchasingAreaId: tt.UUID
) =>
  pipe(
    rm.purchasing.get(purchasingAreaId, new Date()),
    O.exists(purchasingArea =>
      purchasingArea.purchasers.some(purchaser =>
        allMemberNumbers(purchaser).includes(memberNumber)
      )
    )
  );

// The outcome is always worked out here, from the answer, the estimate and
// this year's budget figures, whatever the page may have previewed. The line
// costs are not required to add up to the estimate (an open product
// question); the estimate is what counts against the budget.
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
      submitterMemberNumber(command.actor)
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
    E.let('classification', ({purchasingArea}) =>
      classifyPurchase({
        isMemberPaidConsumable: command.isMemberPaidConsumable,
        amountPence: command.estimatedAmount,
        yearlyBudgetPence: purchasingArea.yearlyBudgetPence,
        spentThisYearPence: purchasingArea.spentThisYearPence,
      })
    ),
    E.bind('purchases', () => normalisePurchases(command.purchases)),
    E.map(
      ({submittedByMemberNumber, purchasingArea, classification, purchases}) =>
        O.some(
          constructEvent('PurchaseRequestSubmitted')({
            id: command.id,
            purchasingAreaId: purchasingArea.id,
            submittedByMemberNumber,
            summary: command.summary.trim(),
            estimatedAmountPence: command.estimatedAmount,
            purchases,
            justification: command.justification.trim(),
            isMemberPaidConsumable: command.isMemberPaidConsumable,
            outcome: classification.outcome,
            approval: classification.approval,
            outcomeReason: classification.reason,
            budgetYear: budgetYearOf(now),
            yearlyBudgetPence: purchasingArea.yearlyBudgetPence,
            spentThisYearPence: purchasingArea.spentThisYearPence,
            actor: command.actor,
          })
        )
    ),
    TE.fromEither
  );
};

// Purchasers for this purchasing area, and super users.
const isAuthorized: Command<SubmitPurchaseRequest>['isAuthorized'] = ({
  actor,
  rm,
  input,
}) =>
  isAdminOrSuperUser({actor, rm}) ||
  (actor.tag === 'user' &&
    isPurchaserFor(rm, actor.user.memberNumber, input.purchasingAreaId));

export const submit: Command<SubmitPurchaseRequest> = {
  process,
  decode: codec.decode,
  isAuthorized,
};
