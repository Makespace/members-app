import {pipe} from 'fp-ts/lib/function';
import {getGravatarThumbnail} from '../../templates/avatar';
import {html, joinHtml, safe, sanitizeOption, sanitizeString} from '../../types/html';
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
import * as RA from 'fp-ts/ReadonlyArray';

const editFormOfAddress = (viewModel: ViewModel) => html`
  <a
    href="/members/edit-form-of-address?member=${viewModel.member.memberNumber}"
  >
    Edit
  </a>
`;

const editAvatar = () =>
  html`<a href="https://gravatar.com/profile">Edit via Gravatar</a>`;

const emailActionForm = (
  action: string,
  label: string,
  viewModel: ViewModel,
  emailAddress: string
) => html`
  <form action="${safe(action)}?next=/me" method="post">
    <input
      type="hidden"
      name="memberNumber"
      value="${viewModel.member.memberNumber}"
    />
    <input type="hidden" name="email" value="${safe(emailAddress)}" />
    <button type="submit">${safe(label)}</button>
  </form>
`;

const renderEmailStatus = (verifiedAt: O.Option<Date>) =>
  O.isSome(verifiedAt) ? 'Verified' : 'Unverified';

const renderEmailActions = (
  viewModel: ViewModel,
  emailAddress: string,
  verifiedAt: O.Option<Date>
) => {
  if (O.isNone(verifiedAt)) {
    return emailActionForm(
      '/members/send-email-verification',
      'Send verification email',
      viewModel,
      emailAddress
    );
  }
  if (emailAddress !== viewModel.member.primaryEmailAddress) {
    return emailActionForm(
      '/members/change-primary-email',
      'Make primary',
      viewModel,
      emailAddress
    );
  }
  return html`Primary`;
};

const renderEmailAddresses = (viewModel: ViewModel) =>
  pipe(
    viewModel.member.emails,
    RA.map(email => html`
      <tr>
        <td>${sanitizeString(email.emailAddress)}</td>
        <td>${sanitizeString(renderEmailStatus(email.verifiedAt))}</td>
        <td>${renderEmailActions(viewModel, email.emailAddress, email.verifiedAt)}</td>
      </tr>
    `),
    rows => html`
      <table>
        <thead>
          <tr>
            <th>Email address</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${joinHtml(rows)}
        </tbody>
      </table>
    `
  );

const renderAddEmailForm = (viewModel: ViewModel) => html`
  <form action="/members/add-email?next=/me" method="post">
    <label for="add-email-address">Add another email address</label>
    <input type="email" id="add-email-address" name="email" />
    <input
      type="hidden"
      name="memberNumber"
      value="${viewModel.member.memberNumber}"
    />
    <button type="submit">Add email</button>
  </form>
`;

const renderMemberDetails = (viewModel: ViewModel) => html`
  <table>
    <tbody>
      <tr>
        <th scope="row">Member number</th>
        <td>${renderMemberNumber(viewModel.member.memberNumber)}</td>
      </tr>
      <tr>
        <th scope="row">Primary email</th>
        <td>${sanitizeString(viewModel.member.primaryEmailAddress)}</td>
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
    <section class="stack">
      <h2>Email addresses</h2>
      ${renderEmailAddresses(viewModel)}
      ${renderAddEmailForm(viewModel)}
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
