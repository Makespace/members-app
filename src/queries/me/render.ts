import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {getGravatarThumbnail} from '../../templates/avatar';
import {
  html,
  sanitizeOption,
  safe,
  sanitizeString,
  joinHtml,
} from '../../types/html';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import {renderMemberNumber} from '../../templates/member-number';
import {superUserNav} from '../landing/render';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';

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

const renderTrainingStatus = (trainedOn: ViewModel['member']['trainedOn']) =>
  pipe(
    trainedOn,
    RA.map(
      equipment =>
        html`<li>
          <a href="/equipment/${safe(equipment.id)}"
            >${sanitizeString(equipment.name)}</a
          >
          (since ${displayDate(DateTime.fromJSDate(equipment.trainedAt))})
        </li>`
    ),
    RA.match(
      () => html`
        <p>You are currently not allowed to use any RED equipment.</p>
      `,
      listItems => html`
        <p>You are permitted to use the following RED equipment:</p>
        <ul>
          ${joinHtml(listItems)}
        </ul>
      `
    )
  );

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Your Makespace profile</h1>
      <h2>Your details</h2>
      ${renderMemberDetails(viewModel)}
      <h2>Training status</h2>
      ${renderTrainingStatus(viewModel.member.trainedOn)}
      ${viewModel.member.isSuperUser ? superUserNav : ''}
    `,
    pageTemplate(safe('Member'), viewModel.user)
  );
