import {html} from '../../types/html';
import {ViewModel} from './view-model';
import {
  renderOptionalDetail,
  renderAvatarProfile,
  renderAvatarThumbnail,
} from '../../templates';

const ownPageBanner = '<h1>This is your profile!</h1>';

const editName = (viewModel: ViewModel) =>
  `<a href="/members/edit-name?member=${viewModel.member.number}">Edit</a>`;

const editPronouns = (viewModel: ViewModel) =>
  `<a href="/members/edit-pronouns?member=${viewModel.member.number}">Edit</a>`;

const editAvatar = () =>
  '<a href="https://gravatar.com/profile">Edit via Gravatar</a>';

const ifSelf = (viewModel: ViewModel, fragment: string) =>
  viewModel.isSelf ? fragment : '';

export const render = (viewModel: ViewModel) => html`
  ${ifSelf(viewModel, ownPageBanner)}
  <div class="profile">${renderAvatarProfile(viewModel.member)}</div>
  <table>
    <caption>
      Details
    </caption>
    <tbody>
      <tr>
        <th scope="row">Member number</th>
        <td>${viewModel.member.number}</td>
      </tr>
      <tr>
        <th scope="row">Email</th>
        <td>${viewModel.member.email}</td>
      </tr>
      <tr>
        <th scope="row">Name</th>
        <td>
          ${renderOptionalDetail(viewModel.member.name)}
          ${ifSelf(viewModel, editName(viewModel))}
        </td>
      </tr>
      <tr>
        <th scope="row">Pronouns</th>
        <td>
          ${renderOptionalDetail(viewModel.member.pronouns)}
          ${ifSelf(viewModel, editPronouns(viewModel))}
        </td>
      </tr>
      <tr>
        <th scope="row">Avatar</th>
        <td>
          ${renderAvatarThumbnail(viewModel.member)}
          ${ifSelf(viewModel, editAvatar())}
        </td>
      </tr>
    </tbody>
  </table>
`;
