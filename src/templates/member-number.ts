import {html} from '../types/html';

export const renderMemberNumber = (memberNumber: number) => html`
  <a class=memberNumberLink href=/member/${memberNumber}/><b>${memberNumber}</b></a>
`;
