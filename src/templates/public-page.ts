import {logInPath} from '../authentication/login/routes';
import {html, Html, HtmlSubstitution, safe} from '../types/html';
import {isolatedPageTemplate} from './page-template';

// A page somebody can see without logging in: no navbar, as there is nobody
// to show it to, just a way to log in that comes back to where they were.
// returnTo is where logging in from the header comes back to.
export const publicPage =
  (title: HtmlSubstitution, returnTo?: string) => (body: Html) =>
    isolatedPageTemplate(title)(html`
      <header class="public-header">
        <strong>Makespace</strong>
        <a
          href="${safe(logInPath)}${returnTo === undefined
            ? safe('')
            : safe(`?next=${encodeURIComponent(returnTo)}`)}"
          >Log in</a
        >
      </header>
      <main class="public-page">${body}</main>
    `);
