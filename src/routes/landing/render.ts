import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';

const renderMemberDetails = (user: ViewModel['user']) => html`
  <dl>
    <dt>Email</dt>
    <dd>${user.emailAddress}</dd>
    <dt>Member Number</dt>
    <dd>${user.memberNumber}</dd>
  </dl>
`;

const renderTrainers = (trainers: ViewModel['trainers']) =>
  pipe(
    trainers,
    RA.map(
      trainer => html`
        <tr>
          <td>${trainer.name}</td>
          <td>${trainer.equipment}</td>
          <td>${trainer.email}</td>
          <td>${trainer.becameTrainerAt.toDateString()}</td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no trainers</p> `,
      rows => html`
        <table>
          <tr>
            <th>Name</th>
            <th>Equipment</th>
            <th>Email</th>
            <th>Trainer since</th>
          </tr>
          ${rows.join('\n')}
        </table>
      `
    )
  );

const superUserNav = html`
  <h2>Admin</h2>
  <p>You have super-user privileges. You can:</p>
  <nav>
    <ul>
      <li>
        <a href="/areas/create">Add area of responsibility</a>
      </li>
      <li>
        <a href="/super-users">View all super-users</a>
      </li>
    </ul>
  </nav>
`;

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Makespace Member Dashboard</h1>
      <h2>Your Details</h2>
      ${renderMemberDetails(viewModel.user)}
      ${viewModel.isSuperUser ? superUserNav : ''}

      </table>
      <h2>Trainers</h2>
      ${renderTrainers(viewModel.trainers)}
    `,
    pageTemplate('Dashboard', O.some(viewModel.user))
  );
