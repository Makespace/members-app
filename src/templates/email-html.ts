import {html, Html, safe} from '../types/html';

// Email HTML is attacker-controlled: anyone who can email the group can put
// whatever they like in it. Rather than trusting a sanitiser to strip every
// dangerous construct, the message is rendered in a sandboxed iframe, which
// is a boundary the browser enforces:
//
//  - no allow-scripts, so nothing in the message can execute;
//  - its own CSP, which by default blocks every remote load.
//
// allow-same-origin is granted so the page can measure the rendered height
// and size the frame to its content - a frame that scrolls inside the page
// reads badly. That pairing is safe precisely because allow-scripts is
// withheld: the message is inert markup, so there is no code inside the
// frame to make use of the origin. The dangerous combination is the two
// together, which is why they are never both given.
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
    // The frame is a separate document, so it cannot reach the site's
    // stylesheet or its custom properties: these values mirror :root and
    // body in static/styles.css so a message reads as part of the page.
    // Senders who set their own fonts and colours still win, as they should.
    '<style>',
    'body{',
    "font-family:Optima,Candara,'Noto Sans',source-sans-pro,sans-serif;",
    'font-size:1rem;line-height:1.5;color:#0b0c0c;',
    'margin:0;padding:0;overflow-wrap:break-word;background:transparent',
    '}',
    'a{color:#1d70b8;text-underline-offset:0.16em}',
    'a:hover{color:#003078;text-decoration-thickness:3px}',
    'img{max-width:100%;height:auto}',
    'table{max-width:100%}',
    'blockquote{',
    'margin:0.5rem 0;padding-left:1rem;',
    'border-left:5px solid #b1b4b6;color:#505a5f',
    '}',
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
    data-email-frame
    scrolling="no"
    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    referrerpolicy="no-referrer"
    srcdoc="${safe(forSrcdoc(document(bodyHtml, showImages)))}"
  ></iframe>
`;
