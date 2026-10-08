import {html, safe} from '../types/html';

export const UPLOAD_PATH = safe('/members/import-fobs');
export const PREVIEW_PATH = safe('/members/import-fobs/preview');
export const STATUS_PATH = safe('/members/import-fobs/status');

export const renderUploadForm = () => html`
  <h1>Import fobs from Paxton</h1>
  <p>
    Upload the token export from the Paxton PC (Users → export, the file is
    usually called <code>tokens.csv</code>). Nothing is changed until you have
    checked the preview on the next page.
  </p>
  <p>
    Each row is matched to a member by the member number in its Paxton name
    (e.g. <i>Millions, Molly 1337</i>); rows without a number are matched by
    name where that is unambiguous, and the rest are left for you to fill in.
  </p>
  <form action="${PREVIEW_PATH}" method="post" enctype="multipart/form-data" class="stack">
    <label class="stack">
      <strong>Paxton token export</strong>
      <input type="file" name="file" accept=".csv,text/csv" />
    </label>
    <details>
      <summary>Or paste the export's contents</summary>
      <textarea name="csv" rows="12"></textarea>
    </details>
    <button type="submit">Preview changes</button>
  </form>
`;
