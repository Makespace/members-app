import {Html, html, HtmlSubstitution, Safe} from '../../types/html';


export const tooltipWith = (text: HtmlSubstitution, content: Html | Safe) => html`
  <div class="tooltip">
    ${content}
    <span class="tooltiptext"> ${text} </span>
  </div>
`;

export const tooltip = (text: HtmlSubstitution) => tooltipWith(text, html`<i class="fa-regular fa-circle-question"></i>`);
