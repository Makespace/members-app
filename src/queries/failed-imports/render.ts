import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';
import {pageTemplate} from '../../templates';

const renderFailedLinkings = (failedImports: ViewModel['failedImports']) =>
  pipe(
    failedImports,
    RA.map(
      item =>
        html`<li>
          <b>${item.memberNumber}</b> -- ${sanitizeString(item.email)}
        </li>`
    ),
    joinHtml,
    joined =>
      html`<ul>
        ${joined}
      </ul>`
  );

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Failed member imports</h1>
      <p>
        During import from the legacy database the following members could not
        be imported because the email address is already used by another member.
      </p>
      ${renderFailedLinkings(viewModel.failedImports)}
    `,
    pageTemplate(safe('Failed member imports'), viewModel.user)
  );
