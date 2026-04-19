import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';

type FailureSection = {
  eventType: string;
  failures: ViewModel['failures'][number][];
};

const renderEntry = (failure: ViewModel['failures'][number]) => html`
  <li>
    <b>${sanitizeString(failure.error)}</b><br/>
    ${sanitizeString(JSON.stringify(failure.payload))}
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

  sections.sort((a, b) => a.eventType.localeCompare(b.eventType))

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
    <h2>${sanitizeString(section.eventType)}</h2>
    ${renderEntries(section.failures)}
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
  ${renderLog(viewModel.failures)}
`;
