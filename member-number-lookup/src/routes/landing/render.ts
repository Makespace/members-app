import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {Trainer} from '../../types/trainer';
import {User} from '../../types';

type Area = {
  name: string;
  description: string;
};

type ViewModel = {
  user: User;
  trainers: ReadonlyArray<Trainer>;
  isSuperUser: boolean;
  areas: ReadonlyArray<Area>;
};

const renderMemberDetails = (user: ViewModel['user']) => html`
  <dl>
    <dt>Email</dt>
    <dd>${user.emailAddress}</dd>
    <dt>Member Number</dt>
    <dd>${user.memberNumber}</dd>
  </dl>
`;

const renderAreas = (areas: ViewModel['areas']) =>
  pipe(
    areas,
    RA.map(
      area => html`
        <tr>
          <td>${area.name}</td>
          <td>${area.description}</td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no Areas</p> `,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('\n')}
          </tbody>
        </table>
      `
    )
  );

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
        <a href="/command/add-area-of-responsibility"
          >Add area of responsibility</a
        >
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

      <h2>Areas</h2>
      ${renderAreas(viewModel.areas)}

      </table>
      <h2>Trainers</h2>
      ${renderTrainers(viewModel.trainers)}
    `,
    pageTemplate('Dashboard', O.some(viewModel.user))
  );
