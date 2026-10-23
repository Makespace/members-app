import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {Form} from '../../types/form';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {EmailAddress} from '../../types';
import {
  allMemberNumbers,
  PurchasingArea,
} from '../../read-models/shared-state/return-types';
import {renderMemberNumber} from '../../templates/member-number';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  actionReturningTo,
  purchasingAreaFromParams,
  purchasingAreaPath,
} from './helpers';

type Candidate = {
  memberNumber: number;
  name: O.Option<string>;
  emailAddress: EmailAddress;
  ownerOf: ReadonlyArray<string>;
};

type ViewModel = {
  purchasingArea: PurchasingArea;
  // Owners of the purchasing area's areas who are not purchasers yet.
  candidates: ReadonlyArray<Candidate>;
};

const renderCandidate =
  (purchasingArea: PurchasingArea) => (candidate: Candidate) => html`
    <tr>
      <td>
        ${pipe(
          candidate.name,
          O.map(sanitizeString),
          O.getOrElseW(() => sanitizeString(candidate.emailAddress))
        )}
        ${renderMemberNumber(candidate.memberNumber)}
      </td>
      <td>${sanitizeString(candidate.ownerOf.join(', '))}</td>
      <td>
        <form
          action="${safe(actionReturningTo('add-purchaser', purchasingArea.id))}"
          method="post"
        >
          <input
            type="hidden"
            name="purchasingAreaId"
            value="${purchasingArea.id}"
          />
          <input
            type="hidden"
            name="memberNumber"
            value="${candidate.memberNumber}"
          />
          <button type="submit">Add</button>
        </form>
      </td>
    </tr>
  `;

const renderCandidates = (viewModel: ViewModel) =>
  viewModel.candidates.length === 0
    ? html`<p>
        Nobody to add. Purchasers must own at least one of this purchasing
        area's areas, and every owner already is one (or it has no areas or
        owners yet).
      </p>`
    : html`
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Owner of</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${pipe(
              viewModel.candidates,
              RA.map(renderCandidate(viewModel.purchasingArea)),
              joinHtml
            )}
          </tbody>
        </table>
      `;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>
          Add a purchaser for ${sanitizeString(viewModel.purchasingArea.name)}
        </h1>
        <p>
          Owners of its areas can request purchases. Purchasers approve them,
          and can make a purchase themselves when it doesn't need a proposal;
          anything that does goes to the directors. Purchasers are chosen from
          the owners of its areas, and stop counting as one if they stop being
          an owner.
        </p>
        ${renderCandidates(viewModel)}
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Add purchaser'), {
      href: purchasingAreaPath(viewModel.purchasingArea.id),
      label: viewModel.purchasingArea.name,
    })
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      purchasingAreaFromParams(readModel, input),
      E.map(purchasingArea => {
        const purchaserNumbers = purchasingArea.purchasers.flatMap(
          allMemberNumbers
        );
        const candidates = new Map<number, Candidate>();
        for (const summary of purchasingArea.areas) {
          const area = readModel.area.get(summary.id);
          if (O.isNone(area)) {
            continue;
          }
          for (const owner of area.value.owners) {
            if (purchaserNumbers.includes(owner.memberNumber)) {
              continue;
            }
            const existing = candidates.get(owner.memberNumber);
            candidates.set(owner.memberNumber, {
              memberNumber: owner.memberNumber,
              name: owner.name,
              emailAddress: owner.primaryEmailAddress,
              ownerOf: [...(existing?.ownerOf ?? []), summary.name],
            });
          }
        }
        return {purchasingArea, candidates: [...candidates.values()]};
      }),
      TE.fromEither
    );

export const addPurchaserForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
