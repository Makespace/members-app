import {html, safe} from '../types/html';
import {EquipmentCategory} from '../types/equipment-category';

// The single home of what each sticker colour means in the app.
const DESCRIPTIONS: Record<EquipmentCategory, string> = {
  red: 'Members only. Training required before use.',
  orange: 'Members only. Only use if confident to do so.',
  green: 'All members & guests',
};

const LABELS: Record<EquipmentCategory, string> = {
  red: 'Red',
  orange: 'Orange',
  green: 'Green',
};

// A small coloured dot + label, usable inline anywhere equipment is listed.
export const categoryBadge = (category: EquipmentCategory) =>
  html`<span class="eq-cat eq-cat--${safe(category)}"
    ><span class="eq-cat__dot" aria-hidden="true"></span
    >${safe(LABELS[category])}</span
  >`;

// Just the dot, for dense lists.
export const categoryDot = (category: EquipmentCategory) =>
  html`<span
    class="eq-cat__dot eq-cat__dot--standalone eq-cat--${safe(category)}"
    title="${safe(LABELS[category])} equipment"
    aria-label="${safe(LABELS[category])} equipment"
  ></span>`;

export const categoryDescription = (category: EquipmentCategory) =>
  safe(DESCRIPTIONS[category]);
