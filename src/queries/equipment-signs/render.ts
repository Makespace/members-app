import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {qrCodeSvg} from '../../templates/qr-code';
import {EquipmentCategory} from '../../types/equipment-category';
import {Sign, ViewModel} from './construct-view-model';

// What each sticker colour tells a member standing in front of the machine.
// The heading is the shorthand people use in the space; the sentence under it
// is the rule.
const CATEGORY_HEADING: Record<EquipmentCategory, string> = {
  red: 'RED EQUIPMENT',
  orange: 'ORANGE EQUIPMENT',
  green: 'GREEN EQUIPMENT',
};

const CATEGORY_RULE: Record<EquipmentCategory, string> = {
  red: 'YOU MUST PASS MAKESPACE TRAINING TO USE THIS EQUIPMENT',
  orange: 'MEMBERS ONLY — ONLY USE IF CONFIDENT TO DO SO',
  green: 'ALL MEMBERS & GUESTS MAY USE THIS EQUIPMENT',
};

const renderSign = (sign: Sign) => html`
  <article class="sign sign--${safe(sign.category)}">
    <div class="sign__inner">
      <h2 class="sign__name">${sanitizeString(sign.name)}</h2>
      <p class="sign__category">${safe(CATEGORY_HEADING[sign.category])}</p>
      <p class="sign__rule">${safe(CATEGORY_RULE[sign.category])}</p>
      <div class="sign__footer">
        <div class="sign__qr">${qrCodeSvg(sign.url, 180)}</div>
        <div class="sign__qr-label">
          <p class="sign__qr-title">Something wrong with this equipment?</p>
          <p>
            Scan to see what has already been reported, and to report a
            problem yourself.
          </p>
          <p class="sign__url">${sanitizeString(sign.url)}</p>
        </div>
      </div>
      <p class="sign__area">${sanitizeString(sign.areaName)}</p>
    </div>
  </article>
`;

const renderChooser = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>Equipment signs</h1>
    <p>
      Printable signs for each machine: its name, what its colour means, and a
      QR code leading to its trouble tickets. Choose an area, then use your
      browser's print dialog — each sign is laid out to fill one landscape
      page.
    </p>
    <ul>
      ${joinHtml(
        viewModel.areas.map(
          area => html`<li>
            <a href="/equipment-signs?areaId=${safe(area.id)}"
              >${sanitizeString(area.name)}</a
            >
            (${safe(String(area.equipmentCount))} to print)
          </li>`
        )
      )}
    </ul>
  </div>
`;

export const render = (viewModel: ViewModel) => {
  if (viewModel.signs.length === 0) {
    return renderChooser(viewModel);
  }
  return html`
    <div class="stack signs-page">
      <div class="signs-page__controls">
        <h1>
          ${pipe(
            viewModel.selectedArea,
            O.match(
              () => html`Equipment sign`,
              area => html`Signs for ${sanitizeString(area.name)}`
            )
          )}
        </h1>
        <p>
          ${safe(String(viewModel.signs.length))}
          sign${viewModel.signs.length === 1 ? '' : safe('s')}, one per page.
          Print landscape. <a href="/equipment-signs">Choose another area</a>.
        </p>
      </div>
      ${joinHtml(viewModel.signs.map(renderSign))}
    </div>
  `;
};
