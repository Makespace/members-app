import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {html} from '../../types/html';
import {ViewModel} from './view-model';

const ownPageBanner = '<h1>This is your profile!</h1>';

const editName = (viewModel: ViewModel) =>
  `<a href="/members/edit-name?member=${viewModel.member.memberNumber}">Edit</a>`;

const editPronouns = (viewModel: ViewModel) =>
  `<a href="/members/edit-pronouns?member=${viewModel.member.memberNumber}">Edit</a>`;

const ifSelf = (viewModel: ViewModel, fragment: string) =>
  viewModel.isSelf ? fragment : '';

const renderOptional = (o: O.Option<string>) =>
  pipe(
    o,
    O.getOrElse(() => '')
  );

export const render = (viewModel: ViewModel) => html`
  ${ifSelf(viewModel, ownPageBanner)}
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
    </tbody>
  </table>
`;
