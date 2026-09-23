import {html, Html, safe} from '../types/html';

// Email HTML is attacker-controlled: anyone who can email the group can put
// whatever they like in it. Rather than trusting a sanitiser to strip every
// dangerous construct, the message is rendered in a sandboxed iframe, which
// is a boundary the browser enforces:
//
//  - no allow-scripts, so nothing in the message can execute;
//  - no allow-same-origin, so it cannot reach the app's cookies or DOM;
//  - its own CSP, which by default blocks every remote load.
//
// That last point is the privacy one. Remote images in email are routinely
// tracking pixels: loading them tells the sender exactly when Makespace read
// their message, and from where. They stay blocked until someone asks for
// them, the same bargain Gmail offers.
const csp = (showImages: boolean) =>
  [
    "default-src 'none'",
    `img-src data:${showImages ? ' https:' : ''}`,
    "style-src 'unsafe-inline'",
    'font-src data:',
  ].join('; ');

// Escaping for a double-quoted attribute. Angle brackets must survive - they
// are the document.
const forSrcdoc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const document = (bodyHtml: string, showImages: boolean) =>
  [
    '<!doctype html>',
    '<html><head>',
    `<meta http-equiv="Content-Security-Policy" content="${csp(showImages)}">`,
    '<meta name="referrer" content="no-referrer">',
    // Links open in a new tab rather than replacing the frame.
    '<base target="_blank">',
    '<style>',
    'body{font:1rem/1.5 system-ui,sans-serif;color:#0b0c0c;margin:0;padding:0.5rem;overflow-wrap:break-word}',
    'img{max-width:100%;height:auto}',
    'table{max-width:100%}',
    '</style>',
    '</head><body>',
    bodyHtml,
    '</body></html>',
  ].join('');

export const renderEmailHtml = (
  bodyHtml: string,
  showImages: boolean
): Html => html`
  <iframe
    class="email-html"
    title="Message content"
    sandbox="allow-popups allow-popups-to-escape-sandbox"
    referrerpolicy="no-referrer"
    srcdoc="${safe(forSrcdoc(document(bodyHtml, showImages)))}"
  ></iframe>
`;
