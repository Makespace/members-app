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
import {PROPOSAL_THRESHOLD_PENCE} from '../../purchasing/classify-purchase';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  PurchaseRequestFormViewModel,
  renderSubmitForm,
} from './render-submit-form';

const renderForm = (viewModel: PurchaseRequestFormViewModel) =>
  toLoggedInContentWithBackLink(safe('Request a purchase'), {
    href: '/purchasing-areas',
    label: 'Purchasing areas',
  })(renderSubmitForm(viewModel));

// Purchasers see the purchasing areas they purchase for; super users see
// them all. Anyone else gets the page explaining how to become a purchaser.
const constructForm: Form<PurchaseRequestFormViewModel>['constructForm'] =
  input =>
  ({readModel, user}) => {
    const now = new Date();
    const purchasingAreas = isAdminOrSuperUser({
      actor: liftActorOrUser(user),
      rm: readModel,
    })
      ? readModel.purchasing.getAll(now)
      : pipe(
          readModel.members.getByMemberNumber(user.memberNumber),
          O.match(
            () => [],
            member => readModel.purchasing.getForPurchaser(member.userId, now)
          )
        );
    const preselected = pipe(
      input,
      t.type({purchasingArea: UUID}).decode,
      E.map(params => params.purchasingArea),
      O.fromEither,
      O.filter(id => purchasingAreas.some(purchasingArea => purchasingArea.id === id))
    );
    return TE.right({
      requestId: v4() as UUID,
      budgetYear: budgetYearOf(now),
      purchasingAreas: purchasingAreas.map(purchasingArea => ({
        id: purchasingArea.id,
        name: purchasingArea.name,
        areaNames: purchasingArea.areas.map(area => area.name),
        yearlyBudgetPence: purchasingArea.yearlyBudgetPence,
        spentThisYearPence: purchasingArea.spentThisYearPence,
        remainingPence: purchasingArea.remainingPence,
      })),
      preselected,
      proposalThresholdPence: PROPOSAL_THRESHOLD_PENCE,
    });
  };

export const submitForm: Form<PurchaseRequestFormViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
