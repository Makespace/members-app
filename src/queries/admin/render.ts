import {html} from '../../types/html';

export const render = () => html`
  <div class="stack-large">
    <h1>Admin</h1>
  <p>You have super-user privileges.</p>
  <nav>
    <ul class="stack">
      <li><a href="/members">View all members</a></li>
      <li><a href="/areas">Manage areas and owners</a></li>
      <li><a href="/super-users">Manage super-users</a></li>
      <li>
        <a href="/members/failed-imports">View failed member number imports</a>
      </li>
      <li>
        <a href="/event-log.csv">View log of all actions taken</a>
      </li>
      <li><a href="/members/create">Link an email and number</a></li>
      <li><a href="/training-status.csv">Download current owners and trainers</li>
    </ul>
  </nav>
  </div>
`;
