import {pipe} from 'fp-ts/lib/function';
import {getGravatarProfile, getGravatarThumbnail} from '../../templates/avatar';
import {
  Html,
  html,
  sanitizeOption,
  safe,
  sanitizeString,
} from '../../types/html';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import {renderMemberNumber} from '../../templates/member-number';

const ownPageBanner = html`<h1>This is your profile!</h1>`;

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

const ifSelf = (viewModel: ViewModel, fragment: Html) =>
  viewModel.isSelf ? fragment : '';

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      ${ifSelf(viewModel, ownPageBanner)}
      <div class="profile">
        ${getGravatarProfile(
          viewModel.member.gravatarHash,
          viewModel.member.memberNumber
        )}
      </div>
      <table>
        <caption>
          Details
        </caption>
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
            <td>
              ${sanitizeOption(viewModel.member.name)}
              ${ifSelf(viewModel, editName(viewModel))}
            </td>
          </tr>
          <tr>
            <th scope="row">Pronouns</th>
            <td>
              ${sanitizeOption(viewModel.member.pronouns)}
              ${ifSelf(viewModel, editPronouns(viewModel))}
            </td>
          </tr>
          <tr>
            <th scope="row">Avatar</th>
            <td>
              ${getGravatarThumbnail(
                viewModel.member.gravatarHash,
                viewModel.member.memberNumber
              )}
              ${ifSelf(viewModel, editAvatar())}
            </td>
          </tr>
        </tbody>
      </table>
    `,
    pageTemplate(safe('Member'), viewModel.user)
  );
