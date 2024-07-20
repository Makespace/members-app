import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, optionalSafe, sanitizeString} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {getGravatarThumbnail} from '../../templates/avatar';
import {renderMemberNumber} from '../../templates/member-number';

const renderMembers = (viewModel: ViewModel) =>
  pipe(
    viewModel.members,
    RA.map(
      member => html`
        <tr>
          <td>
            ${getGravatarThumbnail(member.emailAddress, member.memberNumber)}
          </td>
          <td>${renderMemberNumber(member.memberNumber)}</td>
          <td>${optionalSafe(member.name)}</td>
          <td>${optionalSafe(member.pronouns)}</td>
          <td>
            ${viewModel.viewerIsSuperUser
              ? sanitizeString(member.emailAddress)
              : html`*****`}
          </td>
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
            ${joinHtml(rows)}
          </tbody>
        </table>
      `
    )
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Members of Makespace</h1>
  ${renderMembers(viewModel)}
`;
