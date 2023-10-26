import {html} from '../types/html';
import * as O from 'fp-ts/Option';
import {navbar} from './navbar';
import {head} from './head';
import {User} from '../types';

export const pageTemplate =
  (title: string, user: O.Option<User>) => (body: string) => html`
    <!doctype html>
    <html lang="en">
      ${head(title)}
      <header>${navbar(user)}</header>
      <body>
        ${body}
      </body>
    </html>
  `;
