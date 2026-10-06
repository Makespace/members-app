import {html, joinHtml, sanitizeString} from '../types/html';
import {UPLOAD_PATH} from './render-upload-form';

export type ImportSummary = {
  recorded: number;
  removed: number;
  skipped: number;
  // One line per row that could not be applied, for the admin to chase.
  failures: ReadonlyArray<string>;
};

export const renderSummary = (summary: ImportSummary) => html`
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
  <p>
    <a href="${UPLOAD_PATH}">Upload another export</a> ·
    <a href="/admin">Back to admin</a>
  </p>
`;
