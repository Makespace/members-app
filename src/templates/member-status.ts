import {Html, html, sanitizeString, safe} from '../types/html';

const tag = (fragment: Html, color: string) =>
  html`<strong class="tag tag--${safe(color)}">${fragment}</strong>`;

export const memberStatusTag = (status: string) => {
  switch (status) {
    case 'active':
      return tag(html`active`, 'green');
    case 'inactive':
      return tag(html`inactive`, 'grey');
    default:
      return tag(html`${sanitizeString(status)}`, 'grey');
  }
};
