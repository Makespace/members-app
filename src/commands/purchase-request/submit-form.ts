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
import {PositivePenceFromPoundsString} from '../../types/money';
import {SharedReadModel} from '../../read-models/shared-state';
import {User} from '../../types';
import {readRequestedStep} from '../../templates/multi-page-form';
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
    areaNames: purchasingArea.areas.map(area => area.name),
    yearlyBudgetPence: purchasingArea.yearlyBudgetPence,
    spentThisYearPence: purchasingArea.spentThisYearPence,
    remainingPence: purchasingArea.remainingPence,
  }));

// The form is filled in a page at a time (see render-submit-form.ts). Each
// request carries every answer so far; the page shown is the one asked for,
// unless an earlier page still has something missing, in which case that
// page is shown with a note of what's needed - so editing ?step= can't skip
// ahead.
const constructForm: Form<PurchaseRequestFormViewModel>['constructForm'] =
  input =>
  ({readModel, user}) => {
    const now = new Date();
    const purchasingAreas = purchasingAreasFor(readModel, user, now);
    const given = (name: keyof PurchaseRequestAnswers) =>
      readAnswer(input, name);
    // ?purchasingArea= (from a purchasing area's page) or being a purchaser
    // for only one area picks it to start with.
    const startingArea =
      purchasingAreas.length === 1
        ? purchasingAreas[0].id
        : readAnswer(input, 'purchasingArea');
    const answers: PurchaseRequestAnswers = {
      purchasingAreaId: given('purchasingAreaId') || startingArea,
      summary: given('summary'),
      justification: given('justification'),
      estimatedAmount: given('estimatedAmount'),
      isMemberPaidConsumable: given('isMemberPaidConsumable'),
    };

    const chosen = O.fromNullable(
      purchasingAreas.find(area => area.id === answers.purchasingAreaId)
    );
    const estimatePence = pipe(
      PositivePenceFromPoundsString.decode(answers.estimatedAmount),
      O.fromEither
    );
    const consumable =
      answers.isMemberPaidConsumable === 'true'
        ? O.some(true)
        : answers.isMemberPaidConsumable === 'false'
          ? O.some(false)
          : O.none;

    const missingFrom = [
      [
        ...(O.isNone(chosen) ? ['the area it is for'] : []),
        ...(answers.summary === '' ? ['a summary'] : []),
        ...(answers.justification === '' ? ['why it is needed'] : []),
      ],
      [
        ...(O.isNone(estimatePence) ? ['an estimate of the cost'] : []),
        ...(O.isNone(consumable)
          ? ['whether members pay for it as a consumable']
          : []),
      ],
    ];
    const firstIncomplete = missingFrom.findIndex(missing => missing.length);
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
      missing: requested > step ? missingFrom[step - 1] : [],
      chosen,
      estimate:
        step === 3
          ? pipe(
              O.Do,
              O.apS('area', chosen),
              O.apS('amountPence', estimatePence),
              O.apS('isMemberPaidConsumable', consumable),
              O.map(({area, amountPence, isMemberPaidConsumable}) => ({
                amountPence,
                classification: classifyPurchase({
                  isMemberPaidConsumable,
                  amountPence,
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
