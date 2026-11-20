import {html, Html, safe, sanitizeString} from '../../types/html';

// A word with a particular meaning here, like "Purchase Area": underlined
// faintly, with its meaning shown on hover, or on focus for a keyboard or a
// tap on a phone. `id` names the definition so the term can point at it.
export const definedTerm = (
  id: string,
  term: Html,
  definition: string
): Html => html`<dfn
  class="defined-term"
  tabindex="0"
  aria-describedby="${safe(id)}"
  >${term}<span class="defined-term__meaning" role="tooltip" id="${safe(id)}"
    >${sanitizeString(definition)}</span
  ></dfn
>`;
