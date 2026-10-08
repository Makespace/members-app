import * as O from 'fp-ts/Option';
import {html, joinHtml, sanitizeString} from '../types/html';
import {UPLOAD_PATH} from './render-upload-form';
import {ImportJob} from './import-runner';

export type ImportSummary = {
  recorded: number;
  removed: number;
  skipped: number;
  // One line per row that could not be applied, for the admin to chase.
  failures: ReadonlyArray<string>;
};

const links = html`
  <p>
    <a href="${UPLOAD_PATH}">Upload another export</a> ·
    <a href="/admin">Back to admin</a>
  </p>
`;

const renderDone = (summary: ImportSummary) => html`
  <h1>Import fobs from Paxton: done</h1>
  <ul>
    <li>${summary.recorded} fobs recorded</li>
    <li>${summary.removed} fobs removed</li>
    <li>${summary.skipped} rows skipped (no member number given)</li>
  </ul>
  ${summary.failures.length === 0
    ? html``
    : html`
        <h2>Could not apply (${summary.failures.length})</h2>
        <ul>
          ${joinHtml(summary.failures.map(f => html`<li>${sanitizeString(f)}</li>`))}
        </ul>
      `}
  ${links}
`;

// Reloads itself every few seconds until the import finishes. A plain page
// refresh rather than script: the status is read from the server each time.
const renderRunning = (job: ImportJob) => html`
  <meta http-equiv="refresh" content="3" />
  <h1>Import fobs from Paxton: running</h1>
  <p>
    ${job.done} of ${job.total} rows done. Each row is written to the event
    store in turn, so a large import takes a few minutes. This page refreshes
    itself; it is safe to leave and come back.
  </p>
  <progress max="${job.total}" value="${job.done}"></progress>
`;

const renderNone = () => html`
  <h1>Import fobs from Paxton</h1>
  <p>No import has run since the app last started.</p>
  ${links}
`;

export const renderStatus = (job: O.Option<ImportJob>) =>
  O.isNone(job)
    ? renderNone()
    : O.isSome(job.value.summary)
      ? renderDone(job.value.summary.value)
      : renderRunning(job.value);
