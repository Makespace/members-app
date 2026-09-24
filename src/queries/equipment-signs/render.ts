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
  <div class="sign-block">
    <p class="sign-block__actions">
      <a
        class="button"
        href="/equipment-signs?equipmentId=${safe(sign.id)}&print=1"
        target="_blank"
        rel="noopener"
        >Print this sign</a
      >
    </p>
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
  </div>
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

// Makespace posters are set in Inter, so the signs are too. Loaded only on
// this page rather than site-wide, and with a system fallback so a sign
// still prints correctly if the font does not arrive.
const interFont = html`
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  </style>
`;

export const render = (viewModel: ViewModel) => {
  if (viewModel.signs.length === 0) {
    return renderChooser(viewModel);
  }
  return html`
    ${interFont}
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
          <a href="/equipment-signs">Choose another area</a>.
        </p>
        <p>
          <button type="button" class="button" data-print-signs>
            Print / save as PDF
          </button>
          <small>
            Choose landscape in the print dialog. Everything but the signs is
            left off the paper.
          </small>
        </p>
      </div>
      ${joinHtml(viewModel.signs.map(renderSign))}
      <script>
        (function () {
          var button = document.querySelector('[data-print-signs]');
          if (button) {
            button.addEventListener('click', function () {
              window.print();
            });
          }
          // Opened from "Print this sign": show the dialog straight away, so
          // the new tab is one step rather than two.
          if (window.location.search.indexOf('print=1') !== -1) {
            window.addEventListener('load', function () {
              window.print();
            });
          }
        })();
      </script>
    </div>
  `;
};
