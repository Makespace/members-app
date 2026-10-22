import {html, Html, safe, SanitizedString} from '../types/html';

// Controls only super users can see, drawn in their own style so it's
// obvious they aren't something every member has: a dashed purple box
// labelled "Super users only" around a group of purple-outlined buttons,
// and purple links for single actions in a list (e.g. Remove).

export const superUserActions = (buttons: Html) => html`
  <div class="super-user-actions">
    <span class="super-user-actions__label">Super users only</span>
    <div class="super-user-actions__buttons">${buttons}</div>
  </div>
`;

// A larger part of a page only super users see, e.g. whole sections of
// actions with their descriptions.
export const superUserSection = (body: Html) => html`
  <div class="super-user-actions super-user-actions--section">
    <span class="super-user-actions__label">Super users only</span>
    ${body}
  </div>
`;

export const superUserButton = (href: SanitizedString | string, label: Html) =>
  html`<a class="button button--super-user" href="${safe(href)}">${label}</a>`;

export const superUserLink = (href: SanitizedString | string, label: Html) =>
  html`<a
    class="super-user-link"
    href="${safe(href)}"
    title="Only super users can do this"
    >${label}</a
  >`;
