import {HttpResponse, Member} from '../types';

import {html, Html} from '../types/html';




const PAGE_TEMPLATE = html`
  <!doctype html>
  <html lang="en">
    {{> head }}
    <header>
    {{> navbar }}
    </header>
    <body>
      {{body}}
      {{> gridjs }}
    </body>
  </html>
`;

// For pages not part of the normal flow.
const ISOLATED_PAGE_TEMPLATE = html`
  <!doctype html>
  <html lang="en">
    {{> head }}
    <body>
      {{body}}
      {{> gridjs }}
    </body>
  </html>
`;

export const pageTemplate =
  (title: string, user: Member) => (body: SafeString) =>
    PAGE_TEMPLATE({
      title,
      user,
      body,
      navbarRequired: true,
    });

export const pageTemplateHandlebarlessBody =
  (title: string, user: Member) => (body: Html) =>
    PAGE_TEMPLATE({
      title,
      user,
      body: new SafeString(body),
      navbarRequired: true,
    });

export const isolatedPageTemplate = (title: string) => (body: Html) =>
  ISOLATED_PAGE_TEMPLATE({
    title,
    body,
  });

export const templatePage: (r: HttpResponse) => HttpResponse =
  HttpResponse.match({
    Redirect: HttpResponse.mk.Redirect,
    Page: ({html}) =>
      HttpResponse.mk.Page({
        html,
      }),
  });
