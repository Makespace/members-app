import {pipe} from 'fp-ts/lib/function';
import {getGravatarThumbnail} from '../../templates/avatar';
import {html, sanitizeOption, safe, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';
import {renderMemberNumber} from '../../templates/member-number';

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

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Your Makespace profile</h1>
      <h2>Your details</h2>
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
            <td>
              ${sanitizeOption(viewModel.member.name)} ${editName(viewModel)}
            </td>
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
                viewModel.member.emailAddress,
                viewModel.member.memberNumber
              )}
              ${editAvatar()}
            </td>
          </tr>
        </tbody>
      </table>
    `,
    pageTemplate(safe('Member'), viewModel.user)
  );
