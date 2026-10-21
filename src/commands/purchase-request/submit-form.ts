import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {safe, toLoggedInContentWithBackLink} from '../../types/html';
import {liftActorOrUser} from '../../read-models/lift-actor-or-user';
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
import {User} from '../../types';
import {readRequestedStep} from '../../templates/multi-page-form';
import {RawProposal, typedProposal} from '../../purchasing/proposal';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
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

// Purchasers see the purchasing areas they purchase for; super users see
// them all. Anyone else gets the page explaining how to become a purchaser.
const purchasingAreasFor = (
  readModel: SharedReadModel,
  user: User,
  now: Date
): ReadonlyArray<PurchasingAreaOption> =>
  (isAdminOrSuperUser({actor: liftActorOrUser(user), rm: readModel})
    ? readModel.purchasing.getAll(now)
    : pipe(
        readModel.members.getByMemberNumber(user.memberNumber),
        O.match(
          () => [],
          member => readModel.purchasing.getForPurchaser(member.userId, now)
        )
      )
  ).map(purchasingArea => ({
    id: purchasingArea.id,
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
    const purchasingAreas = purchasingAreasFor(readModel, user, now);
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
    const purchases = normalisePurchases(answers.purchases);
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
      result:
        step === 3
          ? pipe(
              O.Do,
              O.apS('area', chosen),
              O.apS('purchases', O.fromEither(purchases)),
              O.apS('isMemberPaidConsumable', consumable),
              O.apS('healthAndSafetyRisk', risky),
              O.map(({area, purchases, isMemberPaidConsumable, healthAndSafetyRisk}) => ({
                purchases,
                totalPence: totalPence(purchases),
                affectedAreaNames,
                classification: classifyPurchase({
                  affectedAreaNames,
                  healthAndSafetyRisk,
                  isMemberPaidConsumable,
                  amountPence: totalPence(purchases),
                  yearlyBudgetPence: area.yearlyBudgetPence,
                  spentThisYearPence: area.spentThisYearPence,
                }),
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
