import {getGravatarThumbnail} from '../../templates/avatar';
import {Html, html, joinHtml, sanitizeOption, sanitizeString} from '../../types/html';
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
import { MemberEmail } from '../../read-models/shared-state/return-types';
import { EmailAddress } from '../../types';
import { tooltip } from '../shared-render/tool-tip';

const editFormOfAddress = (viewModel: ViewModel) => html`
  <a
    href="/members/edit-form-of-address?member=${viewModel.member.memberNumber}"
  >
    Edit
  </a>
`;

const sendVerifyEmail = (email: EmailAddress) => html`
  <a
    href="/members/send-email-verification?email=${sanitizeString(email)}"
  >
    Send Verification Email
  </a>
`;

const setPrimaryEmail = (email: EmailAddress) => html`
  <a
    href="/members/change-primary-email?email=${sanitizeString(email)}"
  >
    Set Primary Email
  </a>
`;

const addEmail = (memberNumber: number) => html`
  <a
    href="/members/add-email?member=${memberNumber}"
  >
    Add New Email
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
  const emails = viewModel.member.emails.filter(
    email => email.emailAddress != viewModel.member.primaryEmailAddress
  ).toSorted(sortMemberEmailByVerifiedThenAddedDate);

  const renderEmailTableRow = (email: MemberEmail): Html => {
    return html`
    <tr>
      <td></td>
      <td>${sanitizeString(email.emailAddress)}${O.isSome(email.verifiedAt) ? html`✅` : html``}</td>
      <td>${O.isSome(email.verifiedAt) ? setPrimaryEmail(email.emailAddress): sendVerifyEmail(email.emailAddress)}</td>
    </tr>
    `;
  };

  return html`<table>
    <tr>
      <td>Primary</td>
      <td>${sanitizeString(viewModel.member.primaryEmailAddress)} ✅</td>
      <td></td>
    </tr>
    ${joinHtml(emails.toSorted(sortMemberEmailByVerifiedThenAddedDate).map(renderEmailTableRow))}
    <tr>
      <td colspan="3">
        ${addEmail(viewModel.member.memberNumber)}
      </td>
    </tr>
  </table>`;
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
