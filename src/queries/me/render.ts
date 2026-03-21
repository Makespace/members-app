import {getGravatarThumbnail} from '../../templates/avatar';
import {html, sanitizeOption, sanitizeString} from '../../types/html';
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
import {MemberEmail} from '../../read-models/shared-state/return-types';
import {EmailAddress} from '../../types';
import {SEND_EMAIL_VERIFICATION_COOLDOWN_MS} from '../../commands/members/email-state';
import {renderMemberEmails} from '../shared-render/member-emails';

const editFormOfAddress = (viewModel: ViewModel) => html`
  <a
    href="/members/edit-form-of-address?member=${viewModel.member.memberNumber}"
  >
    Edit
  </a>
`;

const sendVerifyEmail = (memberNumber: number, email: MemberEmail) => {
  if (
    O.isSome(email.verificationLastSent) && (
      (Date.now() - email.verificationLastSent.value.getTime()) < SEND_EMAIL_VERIFICATION_COOLDOWN_MS
    )
  ) {
    return html`Verification Email Sent At ${sanitizeString(email.verificationLastSent.value.toLocaleTimeString())}!`
  }
  return html`
    <a
      href="/members/send-email-verification?email=${sanitizeString(email.emailAddress)}&member=${memberNumber}"
    >
      Send Verification Email
    </a>
  `;
}

const setPrimaryEmail = (email: EmailAddress, memberNumber: number) => html`
  <a
    href="/members/change-primary-email?email=${sanitizeString(email)}&member=${memberNumber}"
  >
    Make Primary Email
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

const renderEmailAddresses = (viewModel: ViewModel) =>
  renderMemberEmails({
    primaryEmailAddress: viewModel.member.primaryEmailAddress,
    emails: viewModel.member.emails,
    renderAction: email =>
      O.isSome(email.verifiedAt)
        ? setPrimaryEmail(email.emailAddress, viewModel.member.memberNumber)
        : sendVerifyEmail(viewModel.member.memberNumber, email),
    addEmailAction: O.some(addEmail(viewModel.member.memberNumber)),
  });

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
