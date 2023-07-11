import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {Trainer} from '../../types/trainer';
import {User} from '../../types';

type ViewModel = {
  user: User;
  trainers: ReadonlyArray<Trainer>;
};

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

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Makespace Member Dashboard</h1>
      <h2>Your Details</h2>
      ${renderMemberDetails(viewModel.user)}
      <h2>Trainers</h2>
      ${renderTrainers(viewModel.trainers)}
    `,
    pageTemplate('Dashboard', O.some(viewModel.user))
  );
