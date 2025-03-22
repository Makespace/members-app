import {ViewModel} from './view-model';
import {Html, html, safe} from '../../types/html';

export const render = (viewModel: ViewModel): Html => {
  const {events} = viewModel;

  const eventsHtml = events
    .map(
      event => html`
        <tr>
          <td><code>${safe(event.name)}</code></td>
          <td>${safe(event.description)}</td>
        </tr>
      `
    )
    .join('');

  return html`
    <div class="container">
      <h1 class="mt-4 mb-4">Domain Events</h1>
      <p>This page lists all available domain events in the system.</p>

      <div class="card shadow mb-4">
        <div class="card-header py-3">
          <h6 class="m-0 font-weight-bold">All Events (${events.length})</h6>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table
              class="table table-bordered"
              id="dataTable"
              width="100%"
              cellspacing="0"
            >
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${safe(eventsHtml)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
};
