import {HttpResponse, MemberDetails} from '../types';
import Handlebars, {SafeString} from 'handlebars';
import {registerHead} from './head';
import {registerNavBar} from './navbar';
import {registerAvatarHelpers} from './avatar';
import {registerGridJs} from './grid-js';
import {registerFilterListHelper} from './filter-list';
import {registerMemberInput} from './member-input';
import {registerOptionalDetailHelper} from './detail';
import {registerMemberNumberHelper} from '../types/member-number';
import {registerDisplayDateHelper} from '../types/display-date';

registerNavBar();
registerHead();
registerAvatarHelpers();
registerOptionalDetailHelper();
registerMemberNumberHelper();
registerDisplayDateHelper();
registerGridJs();
registerFilterListHelper();
registerMemberInput();

const PAGE_TEMPLATE = Handlebars.compile(`
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
`);

// For pages not part of the normal flow.
const ISOLATED_PAGE_TEMPLATE = Handlebars.compile(`
  <!doctype html>
  <html lang="en">
    {{> head }}
    <body>
      {{body}}
      {{> gridjs }}
    </body>
  </html>
`);

export const pageTemplate =
  (title: string, loggedInMember: MemberDetails) => (body: SafeString) =>
    PAGE_TEMPLATE({
      title,
      loggedInMember,
      body,
      navbarRequired: true,
    });

export const isolatedPageTemplate = (title: string) => (body: SafeString) =>
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
