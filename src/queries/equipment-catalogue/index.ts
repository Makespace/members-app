import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {html, safe, toLoggedInContent} from '../../types/html';

export const equipmentCatalogue: Query = () => () =>
  TE.right(
    toLoggedInContent(safe('Equipment Catalogue'))(html`
      <article class="stack">
        <h1>Equipment catalogue</h1>
        <p>
          This page is intentionally stubbed while the new header navigation is
          being implemented.
        </p>
        <p>
          Future work will turn this into an equipment-first browse experience.
        </p>
      </article>
    `)
  );
