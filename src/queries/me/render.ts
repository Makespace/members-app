import {getGravatarThumbnail} from '../../templates/avatar';
import {html, sanitizeOption, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {renderMemberNumber} from '../../templates/member-number';
import {renderOwnerAgreementStatus} from '../shared-render/owner-agreement';
import {renderOwnerStatus} from '../shared-render/owner-status';
import {
  howToBecomeATrainer,
  renderTrainerStatus,
} from '../shared-render/trainer-status';
import {renderTrainingStatus} from '../shared-render/training-status';
import {ownerResources} from './owner-resources';

const editFormOfAddress = (viewModel: ViewModel) => html`
  <a
    href="/members/edit-form-of-address?member=${viewModel.member.memberNumber}"
  >
    Edit
  </a>
`;

const editAvatar = () =>
  html`<a href="https://gravatar.com/profile">Edit via Gravatar</a>`;

const renderMemberDetails = (viewModel: ViewModel) => html`
  <table>
    <tbody>
      <tr>
        <th scope="row">Member number</th>
        <td>${renderMemberNumber(viewModel.member.memberNumber)}</td>
      </tr>
      <tr>
        <th scope="row">Email</th>
        <td>${sanitizeString(viewModel.member.emailAddress)}</td>
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
      <h2>Train members</h2>
      ${renderTrainerStatus(viewModel.member.trainerFor)}${howToBecomeATrainer}
    </section>
    <section>
      <h2>Your training record</h2>
      ${renderTrainingStatus(viewModel.member.trainedOn, false)}
    </section>
    <section>
      <h2>Area ownership</h2>
      ${renderOwnerAgreementStatus(viewModel.member.agreementSigned, false)}
      ${renderOwnerStatus(viewModel.member.ownerOf, false)} ${ownerResources}
    </section>
  </div>
`;
