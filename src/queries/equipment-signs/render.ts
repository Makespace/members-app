import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Html, html, joinHtml, safe, sanitizeString} from '../../types/html';
import {qrCodeSvg} from '../../templates/qr-code';
import {EquipmentCategory} from '../../types/equipment-category';
import {Sign, ViewModel} from './construct-view-model';

// Paper sizes, smallest first. The sign is laid out in millimetres and its
// type scales from one millimetre-based font size, so the same design holds
// at every size rather than needing a layout each.
const SIZES = [
  {key: 'a7', label: 'Small (A7)', note: 'half a postcard'},
  {key: 'a6', label: 'Postcard (A6)', note: 'the usual choice'},
  {key: 'a5', label: 'Large (A5)', note: 'twice a postcard'},
  {key: 'a4', label: 'Poster (A4)', note: 'for a wall'},
] as const;

type SizeKey = (typeof SIZES)[number]['key'];

export const sizeFrom = (value: unknown): SizeKey =>
  SIZES.some(size => size.key === value) ? (value as SizeKey) : 'a6';

// @page carries the paper size, so the print dialog opens on the right size
// and the sign fills it exactly rather than being scaled to fit.
const pageSize = (size: SizeKey) => html`
  <style>
    @page {
      size: ${safe(size.toUpperCase())} portrait;
      margin: 0;
    }
  </style>
`;

// What each sticker colour tells a member standing in front of the machine.
// The heading is the shorthand people use in the space; the sentence under it
// is the rule.
const CATEGORY_HEADING: Record<EquipmentCategory, string> = {
  red: 'RED EQUIPMENT',
  orange: 'ORANGE EQUIPMENT',
  green: 'GREEN EQUIPMENT',
};

const CATEGORY_RULE: Record<EquipmentCategory, string> = {
  red: 'Training required before use',
  orange: 'Members only — use only if confident',
  green: 'All members & guests',
};

// Inline rather than linked: a sign has to print correctly from a browser
// that may be offline, and an icon that fails to load leaves a title that
// reads oddly.
const spannerIcon = html`<svg
  class="sign__icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path
    d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3Z"
  />
  <path d="M14.7 6.3 18 3l3 3-3.3 3.3" />
</svg>`;

const capIcon = html`<svg
  class="sign__icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M12 4 2 9l10 5 10-5Z" />
  <path d="M6 11.5V17c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5.5" />
</svg>`;

const bookIcon = html`<svg
  class="sign__icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z" />
  <path d="M8 7h7M8 11h7" />
</svg>`;

// Printed for someone to type, so the scheme is dropped: a browser adds it
// back, and those eight characters are eight more chances to mistype.
const forReading = (url: string) => url.replace(/^https?:\/\//, '');

// One code, its title, the line explaining what scanning gets you, and the
// address underneath for anyone whose camera will not scan it.
const scanBlock = (block: {
  qrUrl: string;
  variant: 'learn' | 'train' | 'fault';
  icon: Html;
  title: string;
  note: string;
}) => html`
  <div class="sign__scan sign__scan--${safe(block.variant)}">
    <div class="sign__qr">${qrCodeSvg(block.qrUrl, 200)}</div>
    <div class="sign__scan-text">
      <p class="sign__scan-title">
        ${block.icon} ${safe(block.title)}
      </p>
      <p class="sign__scan-note">${safe(block.note)}</p>
      <p class="sign__url">${sanitizeString(forReading(block.qrUrl))}</p>
    </div>
  </div>
`;

const renderSign = (sign: Sign) => html`
  <div class="sign-block">
    <article class="sign sign--${safe(sign.category)}">
      <header class="sign__band">
        <p class="sign__band-word">${safe(CATEGORY_HEADING[sign.category])}</p>
        <p class="sign__band-rule">${safe(CATEGORY_RULE[sign.category])}</p>
      </header>
      <h2 class="sign__name">${sanitizeString(sign.name)}</h2>
      <div class="sign__codes">
        ${scanBlock({
          qrUrl: sign.learnUrl,
          variant: 'learn',
          icon: bookIcon,
          title: 'Learn',
          note: 'How it works, what it is for, and what it can do.',
        })}
        ${pipe(
          sign.trainUrl,
          O.match(
            () => html``,
            trainUrl =>
              scanBlock({
                qrUrl: trainUrl,
                variant: 'train',
                icon: capIcon,
                title: 'Get trained',
                note: 'Who can train you, and how training works here.',
              })
          )
        )}
        ${scanBlock({
          qrUrl: sign.url,
          variant: 'fault',
          icon: spannerIcon,
          title: 'Trouble tickets',
          note: 'See what has already been reported, and report a problem yourself.',
        })}
      </div>
    </article>
    <a
      class="button sign-block__print"
      href="/equipment-signs?equipmentId=${safe(sign.id)}&print=1"
      target="_blank"
      rel="noopener"
      >Print this sign</a
    >
  </div>
`;

// Keeps whatever is being printed, and changes only the size.
const sizeLink = (viewModel: ViewModel, size: SizeKey) => {
  const params = new URLSearchParams();
  pipe(
    viewModel.selectedArea,
    O.map(area => params.set('areaId', area.id))
  );
  if (viewModel.signs.length === 1 && O.isNone(viewModel.selectedArea)) {
    params.set('equipmentId', viewModel.signs[0].id);
  }
  params.set('size', size);
  return `/equipment-signs?${params.toString()}`;
};

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
  const size = viewModel.size;
  return html`
    ${interFont} ${pageSize(size)}
    <div class="stack signs-page signs-page--${safe(size)}">
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
        <p class="signs-page__sizes">
          Size:
          ${joinHtml(
            SIZES.map(
              option => html`<a
                class="signs-page__size${option.key === size
                  ? safe(' signs-page__size--active')
                  : safe('')}"
                href="${safe(sizeLink(viewModel, option.key))}"
                >${safe(option.label)}
                <small>${safe(option.note)}</small></a
              >`
            )
          )}
        </p>
        <p>
          <button type="button" class="button" data-print-signs>
            Print / save as PDF
          </button>
          <small>
            The paper size is set for you; leave scaling at 100%. Everything
            but the signs is left off the paper.
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
