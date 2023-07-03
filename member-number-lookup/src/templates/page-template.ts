import {User} from '../authentication';
import {html} from '../types/html';
import * as O from 'fp-ts/Option';
import {navbar} from './navbar';
import {head} from './head';

export const pageTemplate =
  (title: string, user: O.Option<User>) => (body: string) =>
    html`
      <!DOCTYPE html>
      <html lang="en">
        ${head(title)}
        <header>${navbar(user)}</header>
        <body>
          ${body}
        </body>
      </html>
    `;
