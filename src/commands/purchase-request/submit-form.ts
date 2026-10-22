import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {safe, toLoggedInContentWithBackLink} from '../../types/html';
import {budgetYearOf} from '../../purchasing/budget-year';
import {
  classifyPurchase,
  PROPOSAL_THRESHOLD_PENCE,
} from '../../purchasing/classify-purchase';
import {
  normalisePurchases,
  RawPurchases,
  totalPence,
  TypedPurchase,
  typedPurchases,
} from '../../purchasing/purchases';
import {SharedReadModel} from '../../read-models/shared-state';
import {readRequestedStep} from '../../templates/multi-page-form';
import {RawProposal, typedProposal} from '../../purchasing/proposal';
import {BuyerRole, canBuyDirectly} from '../../purchasing/buy-directly';
import {PositivePenceFromPoundsString} from '../../types/money';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';
import {
  PAGE_LABELS,
  PurchaseRequestAnswers,
  PurchaseRequestFormViewModel,
  PurchasingAreaOption,
  renderSubmitForm,
} from './render-submit-form';

const renderForm = (viewModel: PurchaseRequestFormViewModel) =>
  toLoggedInContentWithBackLink(safe('Request a purchase'), {
    href: '/purchasing-areas',
    label: 'Purchasing areas',
  })(renderSubmitForm(viewModel));

// Each answer as a trimmed string ('' when not given yet).
const readAnswer = (input: unknown, name: string) =>
  pipe(
    input,
    t.type({[name]: t.string}).decode,
    E.map(decoded => decoded[name].trim()),
    E.getOrElse(() => '')
  );

// Any member can request a purchase for any purchasing area; a super user
// then approves it.
const purchasingAreasFor = (
  readModel: SharedReadModel,
  now: Date
): ReadonlyArray<PurchasingAreaOption> =>
  readModel.purchasing.getAll(now).map(purchasingArea => ({
    id: purchasingArea.id,
    purchaserMemberNumbers: purchasingArea.purchasers.flatMap(allMemberNumbers),
    name: purchasingArea.name,
    areaIds: purchasingArea.areas.map(area => area.id),
    areaNames: purchasingArea.areas.map(area => area.name),
    yearlyBudgetPence: purchasingArea.yearlyBudgetPence,
    spentThisYearPence: purchasingArea.spentThisYearPence,
    remainingPence: purchasingArea.remainingPence,
  }));

// The shops and items as typed, in order, with entirely blank ones left out.
const readPurchases = (input: unknown): ReadonlyArray<TypedPurchase> =>
  pipe(
    input,
    t.type({purchases: RawPurchases}).decode,
    E.map(({purchases}) => typedPurchases(purchases)),
    E.getOrElse((): ReadonlyArray<TypedPurchase> => [])
  );

// Ticked checkboxes: one arrives as a string, several as a list.
const readAll = (input: unknown, name: string): ReadonlyArray<string> =>
  pipe(
    input,
    t.type({[name]: t.union([t.string, t.array(t.string)])}).decode,
    E.map(decoded => ([] as string[]).concat(decoded[name])),
    E.getOrElse((): ReadonlyArray<string> => [])
  );

const yesNo = (answer: string) =>
  answer === 'true' ? O.some(true) : answer === 'false' ? O.some(false) : O.none;

// The form is filled in a page at a time (see render-submit-form.ts). Each
// request carries every answer so far; the page shown is the one asked for,
// unless an earlier page still has something to sort out, in which case that
// page is shown saying what - so editing ?step= can't skip ahead.
const constructForm: Form<PurchaseRequestFormViewModel>['constructForm'] =
  input =>
  ({readModel, user}) => {
    const now = new Date();
    const purchasingAreas = purchasingAreasFor(readModel, now);
    // ?purchasingArea= (from a purchasing area's page) or being a purchaser
    // for only one area picks it to start with.
    const startingArea =
      purchasingAreas.length === 1
        ? purchasingAreas[0].id
        : readAnswer(input, 'purchasingArea');
    const answers: PurchaseRequestAnswers = {
      purchasingAreaId: readAnswer(input, 'purchasingAreaId') || startingArea,
      summary: readAnswer(input, 'summary'),
      justification: readAnswer(input, 'justification'),
      purchases: readPurchases(input),
      isMemberPaidConsumable: readAnswer(input, 'isMemberPaidConsumable'),
      affectsOtherAreas: readAnswer(input, 'affectsOtherAreas'),
      affectedAreaIds: readAll(input, 'affectedAreaIds'),
      healthAndSafetyRisk: readAnswer(input, 'healthAndSafetyRisk'),
      buyingDirectly: readAnswer(input, 'buyingDirectly'),
      amount: readAnswer(input, 'amount'),
      proposal: pipe(
        input,
        t.type({proposal: RawProposal}).decode,
        E.map(({proposal}) => typedProposal(proposal)),
        E.getOrElse(() => typedProposal(undefined))
      ),
    };

    const chosen = O.fromNullable(
      purchasingAreas.find(area => area.id === answers.purchasingAreaId)
    );
    const isSuperUser = pipe(
      readModel.members.getByMemberNumber(user.memberNumber),
      O.exists(member => member.isSuperUser)
    );
    // Whether they can buy it directly, for the area chosen.
    const buyerRole: BuyerRole = isSuperUser
      ? 'super-user'
      : pipe(
            chosen,
            O.exists(area =>
              area.purchaserMemberNumbers.includes(user.memberNumber)
            )
          )
        ? 'purchaser'
        : 'neither';
    const buyingDirectly = answers.buyingDirectly === 'true';
    // Bought directly, only what it cost is given; otherwise the itemised
    // shops make the total.
    const purchases = buyingDirectly
      ? pipe(
          PositivePenceFromPoundsString.decode(answers.amount),
          E.bimap(
            () => 'Please give what it cost, in pounds, e.g. 42.50.',
            () => []
          )
        )
      : normalisePurchases(answers.purchases);
    const total = pipe(
      purchases,
      E.map(typed =>
        buyingDirectly
          ? pipe(
              PositivePenceFromPoundsString.decode(answers.amount),
              E.getOrElse(() => 0)
            )
          : totalPence(typed)
      )
    );
    const consumable = yesNo(answers.isMemberPaidConsumable);
    const affectsOthers = yesNo(answers.affectsOtherAreas);
    const risky = yesNo(answers.healthAndSafetyRisk);
    // Every area outside the chosen purchasing area, by name.
    const otherAreas = readModel.area
      .getAllMinimal()
      .filter(
        area =>
          !pipe(
            chosen,
            O.exists(purchasingArea => purchasingArea.areaIds.includes(area.id))
          )
      )
      .map(({id, name}) => ({id, name}))
      .sort((a, b) => a.name.localeCompare(b.name));
    const affectedAreaNames = pipe(
      affectsOthers,
      O.exists(Boolean)
    )
      ? otherAreas
          .filter(area => answers.affectedAreaIds.includes(area.id))
          .map(area => area.name)
      : [];

    const classification = pipe(
      O.Do,
      O.apS('area', chosen),
      O.apS('totalPence', O.fromEither(total)),
      O.apS('isMemberPaidConsumable', consumable),
      O.apS('healthAndSafetyRisk', risky),
      O.map(({area, totalPence, isMemberPaidConsumable, healthAndSafetyRisk}) =>
        classifyPurchase({
          affectedAreaNames,
          healthAndSafetyRisk,
          isMemberPaidConsumable,
          amountPence: totalPence,
          yearlyBudgetPence: area.yearlyBudgetPence,
          spentThisYearPence: area.spentThisYearPence,
        })
      )
    );
    // Only checked once everything it depends on is answered.
    const buyingDirectlyProblem = pipe(
      classification,
      O.filter(() => buyingDirectly),
      O.chain(found =>
        pipe(
          canBuyDirectly(buyerRole, {
            affectedAreaNames,
            healthAndSafetyRisk: pipe(risky, O.exists(Boolean)),
            classification: found,
          }),
          E.swap,
          O.fromEither
        )
      )
    );

    const aboutMissing = [
      ...(O.isNone(chosen) ? ['the area it is for'] : []),
      ...(answers.summary === '' ? ['a summary'] : []),
      ...(answers.justification === '' ? ['why it is needed'] : []),
    ];
    const problemsOn = [
      aboutMissing.length > 0
        ? [`Please give ${aboutMissing.join(', ')} before moving on.`]
        : [],
      [
        ...(E.isLeft(purchases) ? [purchases.left] : []),
        ...(O.isNone(consumable)
          ? ['Please say whether members pay for it.']
          : []),
        ...(O.isNone(affectsOthers)
          ? ['Please say whether it will affect any other areas.']
          : pipe(affectsOthers, O.exists(Boolean)) &&
              affectedAreaNames.length === 0
            ? ['Please choose which other areas it affects.']
            : []),
        ...(O.isNone(risky)
          ? [
              'Please say whether it presents a moderate to high health and safety risk.',
            ]
          : []),
        ...pipe(
          buyingDirectlyProblem,
          O.match(
            () => [],
            problem => [problem]
          )
        ),
      ],
    ];
    const firstIncomplete = problemsOn.findIndex(problems => problems.length);
    const furthest =
      firstIncomplete === -1 ? PAGE_LABELS.length : firstIncomplete + 1;
    const requested = readRequestedStep(input, PAGE_LABELS.length);
    const step = Math.min(requested, furthest);

    return TE.right({
      requestId: pipe(
        input,
        t.type({id: UUID}).decode,
        E.map(({id}) => id),
        E.getOrElse(() => v4() as UUID)
      ),
      budgetYear: budgetYearOf(now),
      purchasingAreas,
      proposalThresholdPence: PROPOSAL_THRESHOLD_PENCE,
      step,
      answers,
      problems: requested > step ? problemsOn[step - 1] : [],
      chosen,
      otherAreas,
      buyerRole,
      result:
        step === 3
          ? pipe(
              O.Do,
              O.apS('purchases', O.fromEither(purchases)),
              O.apS('totalPence', O.fromEither(total)),
              O.apS('classification', classification),
              O.map(({purchases, totalPence, classification}) => ({
                purchases,
                totalPence,
                affectedAreaNames,
                classification,
              }))
            )
          : O.none,
    });
  };

export const submitForm: Form<PurchaseRequestFormViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
