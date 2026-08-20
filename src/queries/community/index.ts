import * as TE from 'fp-ts/TaskEither';
import {renderCommunityLinks} from '../../templates/navbar';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Query} from '../query';

export const community: Query = () => () =>
  TE.right(
    toLoggedInContent(safe('Community'))(html`
      <article class="stack">
        <h1>Community</h1>
        ${renderCommunityLinks()}
      </article>
    `)
  );
