import {getGravatarThumbnail} from '../../templates/avatar';
import {html, sanitizeOption, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {renderMemberNumber} from '../../templates/member-number';
import {renderOwnerAgreementStatus} from '../shared-render/owner-agreement';
import {renderOwnerStatus} from '../shared-render/owner-status';
import {renderTrainerStatus} from '../shared-render/trainer-status';
import {renderTrainingStatus} from '../shared-render/training-status';

const editName = (viewModel: ViewModel) =>
  html`<a href="/members/edit-name?member=${viewModel.member.memberNumber}"
    >Edit</a
  >`;

const editPronouns = (viewModel: ViewModel) =>
  html`<a href="/members/edit-pronouns?member=${viewModel.member.memberNumber}"
    >Edit</a
  >`;

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
        <th scope="row">Name</th>
        <td>${sanitizeOption(viewModel.member.name)} ${editName(viewModel)}</td>
      </tr>
      <tr>
        <th scope="row">Pronouns</th>
        <td>
          ${sanitizeOption(viewModel.member.pronouns)}
          ${editPronouns(viewModel)}
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

const superUserNav = html`
  <h2>Admin</h2>
  <p>You have super-user privileges. You can:</p>
  <nav>
    <ul>
      <li><a href="/areas">Manage areas and owners</a></li>
      <li><a href="/super-users">Manage super-users</a></li>
      <li>
        <a href="/members/failed-imports">View failed member number imports</a>
      </li>
      <li>
        <a href="/event-log.csv">View log of all actions taken</a>
      </li>
      <li><a href="/members/create">Link an email and number</a></li>
      <li><a href="/training-status.csv">Download current owners and trainers</li>
    </ul>
  </nav>
`;

export const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>Your Makespace profile</h1>
    <h2>Your details</h2>
    ${renderMemberDetails(viewModel)}
    <h2>Owner status</h2>
    ${renderOwnerAgreementStatus(viewModel.member.agreementSigned, false)}
    ${renderOwnerStatus(viewModel.member.ownerOf, false)}
    <h2>Training status</h2>
    ${renderTrainingStatus(viewModel.member.trainedOn, false)}
    ${renderTrainerStatus(viewModel.member.trainerFor, false)}
    ${viewModel.member.isSuperUser ? superUserNav : ''}
  </div>
`;
