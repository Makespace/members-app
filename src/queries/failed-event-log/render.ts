import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';

type FailureSection = {
  eventType: string;
  failures: ViewModel['failures'][number][];
};

const renderDeleteForm = (eventIndex: number) => html`
  <form action="/event-log/delete?next=/event-log/failed" method="post">
    <input type="hidden" name="eventIndex" value="${eventIndex}" />
    <button type="submit">Delete event</button>
  </form>
`;

const renderEntry = (failure: ViewModel['failures'][number]) => html`
  <li>
    <b>${sanitizeString(failure.error)}</b><br/>
    Event Index: ${failure.eventIndex}<br/>
    Event ID: ${sanitizeString(failure.eventId)}<br/>
    ${sanitizeString(JSON.stringify(failure.payload))}
    ${renderDeleteForm(failure.eventIndex)}
  </li>
`;

const groupFailures = (failures: ViewModel['failures']): ReadonlyArray<FailureSection> => {
  const sections: FailureSection[] = [];

  for (const failure of failures) {
    const section = sections.find(
      ({eventType}) => eventType === failure.eventType
    );

    if (section) {
      section.failures.push(failure);
    } else {
      sections.push({eventType: failure.eventType, failures: [failure]});
    }
  }

  sections.sort((a, b) => a.eventType.localeCompare(b.eventType));

  return sections;
};

const renderEntries = (failures: ViewModel['failures']) =>
  pipe(
    failures,
    RA.map(renderEntry),
    joinHtml,
    items => html`
      <ul>
        ${items}
      </ul>
    `
  );

const renderSection = (section: FailureSection) => html`
  <section>
    <details class="failed-event-log__section">
      <summary class="failed-event-log__summary">
        <h2>${sanitizeString(section.eventType)}</h2>
      </summary>
      ${renderEntries(section.failures)}
    </details>
  </section>
`;

const renderLog = (failures: ViewModel['failures']) =>
  pipe(
    failures,
    groupFailures,
    RA.map(renderSection),
    joinHtml
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Failed event log</h1>
  <p>Showing ${viewModel.count} failed events.</p>
  <p><a href=${safe('/event-log/deleted')}>View deleted events</a></p>
  ${renderLog(viewModel.failures)}
`;
