import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {commaHtml, html} from '../types/html';

export const renderMemberNumber = (memberNumber: number) => html`
  <a class=memberNumberLink href=/member/${memberNumber}/><b>${memberNumber}</b></a>
`;

// Note this is for rendering the member numbers of a single user i.e. member numbers from rejoin.
export const renderMemberNumbers = (memberNumbers: readonly number[]) =>
  pipe(memberNumbers, RA.map(renderMemberNumber), commaHtml);
