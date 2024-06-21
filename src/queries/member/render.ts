import {createHash} from 'crypto';
import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {MemberDetails} from '../../types';
import {html} from '../../types/html';
import {ViewModel} from './view-model';

const ownPageBanner = '<h1>This is your profile!</h1>';

function getGravatarUrl(email: string, size: number = 160) {
  const trimmedEmail = email.trim().toLowerCase();
  const hash = createHash('sha256').update(trimmedEmail).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

function renderAvatarThumbnail(member: MemberDetails) {
  const email = member.email;
  const url1x = getGravatarUrl(email, 40);
  const url2x = getGravatarUrl(email, 80);
  const url4x = getGravatarUrl(email, 160);
  return html`
    <img
      width="40"
      height="40"
      srcset="${url1x} 1x, ${url2x} 2x, ${url4x} 4x"
      src="${url1x}"
      alt="The avatar of ${member.memberNumber}"
    />
  `;
}

function renderAvatarProfile(member: MemberDetails) {
  const email = member.email;
  const url1x = getGravatarUrl(email, 320);
  const url2x = getGravatarUrl(email, 640);
  const url4x = getGravatarUrl(email, 1280);
  return html`
    <img
      width="320"
      height="320"
      srcset="${url1x} 1x, ${url2x} 2x, ${url4x} 4x"
      src="${url1x}"
      alt="The avatar of ${member.memberNumber}"
    />
  `;
}

const editName = (viewModel: ViewModel) =>
  `<a href="/members/edit-name?member=${viewModel.member.memberNumber}">Edit</a>`;

const editPronouns = (viewModel: ViewModel) =>
  `<a href="/members/edit-pronouns?member=${viewModel.member.memberNumber}">Edit</a>`;

const editAvatar = () =>
  '<a href="https://gravatar.com/profile">Edit via Gravatar</a>';

const ifSelf = (viewModel: ViewModel, fragment: string) =>
  viewModel.isSelf ? fragment : '';

const renderOptional = (o: O.Option<string>) =>
  pipe(
    o,
    O.getOrElse(() => '')
  );

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
        <td>${viewModel.member.memberNumber}</td>
      </tr>
      <tr>
        <th scope="row">Email</th>
        <td>${viewModel.member.email}</td>
      </tr>
      <tr>
        <th scope="row">Name</th>
        <td>
          ${renderOptional(viewModel.member.name)}
          ${ifSelf(viewModel, editName(viewModel))}
        </td>
      </tr>
      <tr>
        <th scope="row">Pronouns</th>
        <td>
          ${renderOptional(viewModel.member.pronouns)}
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
