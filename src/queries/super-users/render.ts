import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {DateTime} from 'luxon';
import * as O from 'fp-ts/Option';

const renderSuperUsers = (superUsers: ViewModel['superUsers']) =>
  pipe(
    superUsers,
    RA.map(
      member => html`
        <tr>
          <td>${renderMemberNumber(member.memberNumber)}</td>
          <td>${sanitizeString(O.getOrElse(() => '-')(member.name))}</td>
          <td>${safe(member.emailAddress)}</td>
          <td>
            ${member.superUserSince
              ? displayDate(DateTime.fromJSDate(member.superUserSince))
              : safe('-')}
          </td>
          <td>
            <a href="/super-users/revoke?memberNumber=${member.memberNumber}">
              Revoke
            </a>
          </td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no super-users</p> `,
      rows => html`
        <table>
          <tr>
            <th>Member Number</th>
            <th>Name</th>
            <th>Email</th>
            <th>SU since</th>
            <th></th>
          </tr>
          ${joinHtml(rows)}
        </table>
      `
    )
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Super-users</h1>
  <a href="/super-users/declare">Declare a member to be a super-user</a>
  ${renderSuperUsers(viewModel.superUsers)}
`;
