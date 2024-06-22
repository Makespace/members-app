import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {renderOptionalDetail, renderAvatarThumbnail} from '../../templates';

const renderMembers = (viewModel: ViewModel) =>
  pipe(
    viewModel.members,
    RA.map(
      member => html`
        <tr>
          <td>${renderAvatarThumbnail(member)}</td>
          <td>
            <a href="/member/${member.number}">${member.number}</a>
          </td>
          <td>${renderOptionalDetail(member.name)}</td>
          <td>${renderOptionalDetail(member.pronouns)}</td>
          <td>${viewModel.viewerIsSuperUser ? member.email : '*****'}</td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no members</p> `,
      rows => html`
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Member number</th>
              <th>Name</th>
              <th>Pronouns</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('\n')}
          </tbody>
        </table>
      `
    )
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Members of Makespace</h1>
  ${renderMembers(viewModel)}
`;
