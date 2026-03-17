import {pipe} from 'fp-ts/lib/function';
import {getGravatarThumbnail} from '../../templates/avatar';
import {Html, html, joinHtml, safe, sanitizeOption, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {renderMemberNumber} from '../../templates/member-number';
import {renderOwnerAgreementStatus} from '../shared-render/owner-agreement';
import {renderOwnerStatus} from '../shared-render/owner-status';
import {
  howToBecomeATrainer,
} from '../shared-render/trainer-status';
import {howToGetTrained} from '../shared-render/training-status';
import {ownerResources} from './owner-resources';
import { renderTrainingMatrix } from '../training-matrix/render';
import * as O from 'fp-ts/Option';
import { tooltip } from '../shared-render/tool-tip';
import { MemberEmail } from '../../read-models/shared-state/return-types';

const editFormOfAddress = (viewModel: ViewModel) => html`
  <a
    href="/members/edit-form-of-address?member=${viewModel.member.memberNumber}"
  >
    Edit
  </a>
`;

// TODO - Hook this up to a form
const validateEmail = (viewModel: ViewModel, email: MemberEmail) => html`
  <a
    href="/members/send-email-verification?member=${viewModel.member.memberNumber}"
  >
    Send Validation Email
  </a>
`;

// TODO - Hook this up to a form
const setPrimaryEmail = (viewModel: ViewModel, email: MemberEmail) => html`
  <a
    href="/members/change-primary-email?member=${viewModel.member.memberNumber}"
  >
    Set Primary Email
  </a>
`;

const editAvatar = () =>
  html`<a href="https://gravatar.com/profile">Edit via Gravatar</a>`;

const sortMemberEmailByVerifiedThenAddedDate = (a: MemberEmail, b: MemberEmail): 1 | -1 | 0 => {
  if (O.isSome(a.verifiedAt) && O.isSome(b.verifiedAt)) {
    const aVerifiedTimestamp = a.verifiedAt.value.getTime();
    const bVerifiedTimestamp = b.verifiedAt.value.getTime();
    if (aVerifiedTimestamp > bVerifiedTimestamp) {
      return 1;
    }
    if (aVerifiedTimestamp === bVerifiedTimestamp) {
      return 0;
    }
    return -1;
  }
  if (O.isSome(a.verifiedAt) && O.isNone(b.verifiedAt)) {
    return 1;
  }
  if (O.isSome(b.verifiedAt) && O.isNone(a.verifiedAt)) {
    return -1;
  }
  const aAddedTimestamp = a.addedAt.getTime();
  const bAddedTimestamp = b.addedAt.getTime();
  if (aAddedTimestamp > bAddedTimestamp) {
    return 1;
  }
  if (aAddedTimestamp === bAddedTimestamp) {
    return 0;
  }
  return -1;
};

const renderEmailAddresses = (viewModel: ViewModel) => {
  const rows: Html[] = [];
  rows.push(
    html`- ${sanitizeString(viewModel.member.primaryEmailAddress)} <i class="fa-solid fa-check-double"></i> ${tooltip(safe('The primary email address for this member'))}`
  );

  for (const email of viewModel.member.emails.toSorted(sortMemberEmailByVerifiedThenAddedDate)) {
    if (O.isSome(email.verifiedAt)) {
      rows.push(
        html`- ${sanitizeString(email.emailAddress)} <i class="fa-solid fa-check"></i> ${setPrimaryEmail(viewModel, email)}`
      );
    } else {
      rows.push(
        html`- ${sanitizeString(email.emailAddress)} <i class="fa-solid fa-exclamation"></i> ${validateEmail(viewModel, email)}`
      );
    }
  }

  return joinHtml(rows);
};

const renderMemberDetails = (viewModel: ViewModel) => html`
  <table>
    <tbody>
      <tr>
        <th scope="row">Member number</th>
        <td>${renderMemberNumber(viewModel.member.memberNumber)}</td>
      </tr>
      <tr>
        <th scope="row">Email addresses</th>
        <td>${renderEmailAddresses(viewModel)}</td>
      </tr>
      <tr>
        <th scope="row">
          <p>Name</p>
          <p><small>Used for record keeping</small></p>
        </th>
        <td>${sanitizeOption(viewModel.member.name)}</td>
      </tr>
      <tr>
        <th scope="row">
          <p>Form of address</p>
          <p><small>Preferred pronouns or nickname</small></p>
        </th>
        <td>
          ${sanitizeOption(viewModel.member.formOfAddress)}
          ${editFormOfAddress(viewModel)}
        </td>
      </tr>
      <tr>
        <th scope="row">Avatar</th>
        <td>
          ${getGravatarThumbnail(
            viewModel.member.gravatarHash,
            viewModel.member.memberNumber
          )}
          ${editAvatar()}
        </td>
      </tr>
    </tbody>
  </table>
`;

export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>Your Makespace profile</h1>
    <section>
      <h2>Your details</h2>
      ${renderMemberDetails(viewModel)}
    </section>
    <section>
      ${renderTrainingMatrix(viewModel.trainingMatrix)}
      ${howToBecomeATrainer}
      ${howToGetTrained}
    </section>
    <section>
      <h2>Area ownership</h2>
      ${renderOwnerAgreementStatus(viewModel.member.agreementSigned, false)}
      ${renderOwnerStatus(viewModel.member.ownerOf, false)} ${ownerResources}
    </section>
    
  </div>
`;
