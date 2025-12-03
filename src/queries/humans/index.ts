import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {html, safe} from '../../types/html';
import {pipe} from 'fp-ts/lib/function';
import {render} from './render';
import {toLoggedInContent, safe} from '../../types/html';

export const humans: Query = () => user =>
  pipe(
    {memberNumber: user.memberNumber},
    render,
    toLoggedInContent(safe('Humans')),
    TE.right
  );

type ViewModel = {
  memberNumber: number;
};

export const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>I've worked on the app!</h1>
    <p>Add yourself below!</p>
    <ul>
    </ul>
  </div>
`;
