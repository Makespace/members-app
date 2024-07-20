import {HttpResponse, Member} from '../types';

import {html, Html, HtmlSubstitution, RenderedHtml} from '../types/html';
import {gridJs} from './grid-js';
import {head} from './head';
import {navBar} from './navbar';

export const pageTemplate =
  (title: HtmlSubstitution, user: Member) => (body: Html) =>
    html`
      <!doctype html>
      <html lang="en">
        ${head(title)}
        <header>${navBar(user)}</header>
        <body>
          ${body} ${gridJs()}
        </body>
      </html>
    ` as RenderedHtml;

// For pages not part of the normal flow.
export const isolatedPageTemplate = (title: HtmlSubstitution) => (body: Html) =>
  html`
    <!doctype html>
    <html lang="en">
      ${head(title)}
      <body>
        ${body} ${gridJs()}
      </body>
    </html>
  ` as RenderedHtml;

export const templatePage: (r: HttpResponse) => HttpResponse =
  HttpResponse.match({
    Redirect: HttpResponse.mk.Redirect,
    Page: ({rendered}) =>
      HttpResponse.mk.Page({
        rendered,
      }),
  });
