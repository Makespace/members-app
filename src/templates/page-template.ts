import {HttpResponse, User} from '../types';
import {
  html,
  Html,
  HtmlSubstitution,
  CompleteHtmlDocument,
} from '../types/html';
import {gridJs} from './grid-js';
import {head} from './head';
import {navBar} from './navbar';

export const pageTemplate =
  (title: HtmlSubstitution, user: User) => (body: Html) =>
    html`
      <!doctype html>
      <html lang="en">
        ${head(title)}
        <header>${navBar(user)}</header>
        <body>
          ${body} ${gridJs()}
        </body>
      </html>
    ` as CompleteHtmlDocument;

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
  ` as CompleteHtmlDocument;

export const templatePage: (r: HttpResponse) => HttpResponse =
  HttpResponse.match({
    Redirect: HttpResponse.mk.Redirect,
    Raw: HttpResponse.mk.Raw,
    Page: ({rendered}) =>
      HttpResponse.mk.Page({
        rendered,
      }),
  });
