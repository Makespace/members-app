import {HttpResponse, Member} from '../types';

import {html, Html} from '../types/html';
import {gridJs} from './grid-js';
import {head} from './head';
import {navBar} from './navbar';

export const pageTemplate =
  (title: string, user: Member) => (body: Html) => html`
    <!doctype html>
    <html lang="en">
      ${head(title)}
      <header>${navBar(user)}</header>
      <body>
        ${body} ${gridJs()}
      </body>
    </html>
  `;

// For pages not part of the normal flow.
export const isolatedPageTemplate = (title: string) => (body: Html) => html`
  <!doctype html>
  <html lang="en">
    ${head(title)}
    <body>
      ${body} ${gridJs()}
    </body>
  </html>
`;

export const templatePage: (r: HttpResponse) => HttpResponse =
  HttpResponse.match({
    Redirect: HttpResponse.mk.Redirect,
    Page: ({html}) =>
      HttpResponse.mk.Page({
        html,
      }),
  });
