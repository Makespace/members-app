import {html, Html, joinHtml, sanitizeString} from '../types/html';

export const filterList = <T>(
  context: ReadonlyArray<T>,
  name: string,
  elementTemplate: (element: T) => Html
): Html => html`
  <table data-gridjs>
    <thead>
      <tr>
        <th>${sanitizeString(name)}</th>
      </tr>
    </thead>
    <tbody>
      ${joinHtml(
        context.map(
          item =>
            html`<tr>
              <td>${elementTemplate(item)}</td>
            </tr>`
        )
      )}
    </tbody>
  </table>
`;
