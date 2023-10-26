import {head} from './head';
import {html} from '../types/html';

export const pageTemplateNoNav = (title: string) => (body: string) => html`
  <!doctype html>
  <html lang="en">
    ${head(title)}
    <body>
      ${body}
    </body>
  </html>
`;
