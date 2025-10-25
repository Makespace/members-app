import {html, HtmlSubstitution} from '../../types/html';

export const tooltip = (text: HtmlSubstitution) => html`
  <div class="tooltip">
    <i class="fa-regular fa-circle-question"></i>
    <span class="tooltiptext"> ${text} </span>
  </div>
`;
