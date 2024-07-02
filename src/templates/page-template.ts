import * as O from 'fp-ts/Option';
import {User, HttpResponse} from '../types';
import Handlebars, {SafeString} from 'handlebars';
import { register } from './head';

register();

const PAGE_TEMPLATE = Handlebars.compile(`
    <!doctype html>
    <html lang="en">
      {{> head }}
      <header>
      {{#if navbarRequired}}
      {{> navbar }}
      {{/if}}
      </header>
      <body>
        {{body}}
      </body>
    </html>
  `);

export const pageTemplate =
  (title: string, user: O.Option<User>) =>
  (body: HandlebarsTemplateDelegate | SafeString) =>
    PAGE_TEMPLATE({
      title,
      loggedIn: O.isSome(user),
      body: body,

      // For simplicity the navbar is always present if the user is logged in but
      // we may want to separate these conditions.
      navbarRequired: O.isSome(user),
    });

export const templatePage: (r: HttpResponse) => HttpResponse =
  HttpResponse.match({
    Redirect: HttpResponse.mk.Redirect,
    Page: ({html}) =>
      HttpResponse.mk.Page({
        html,
      }),
  });
