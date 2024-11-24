import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {DateTime} from 'luxon';

const renderSuperUsers = (superUsers: ViewModel['superUsers']) =>
  pipe(
    superUsers,
    RA.map(
      user => html`
        <tr>
          <td>${renderMemberNumber(user.memberNumber)}</td>
          <td>${displayDate(DateTime.fromJSDate(user.since))}</td>
          <td>
            <a href="/super-users/revoke?memberNumber=${user.memberNumber}">
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
    </table>
    ${renderSuperUsers(viewModel.superUsers)}
  `;
