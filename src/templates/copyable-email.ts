import {html, sanitizeString} from '../types/html';
import {EmailAddress} from '../types';

// An email address rendered as a click-to-copy button. Progressive enhancement:
// the address stays readable and selectable without JS. The copy handler (see
// templates/head.ts) reads the button's text content, so the raw address is
// never placed in an attribute - which avoids attribute injection from unusual
// (but valid) quoted local parts.
export const renderCopyableEmail = (email: EmailAddress) => html`
  <button type="button" class="copy-text" title="Copy email address">
    ${sanitizeString(email)}
  </button>
`;
