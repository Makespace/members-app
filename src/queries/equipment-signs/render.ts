import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Html, html, joinHtml, safe, sanitizeString} from '../../types/html';
import {qrCodeSvg} from '../../templates/qr-code';
import {EquipmentCategory} from '../../types/equipment-category';
import {Sign, ViewModel} from './construct-view-model';
import {categoryDescription} from '../../templates/equipment-category';

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

// The heading is the shorthand people use in the space; the sentence under
// it is the rule, taken from the one place in the app that defines what each
// colour means, so a sign cannot drift from a screen.
const CATEGORY_HEADING: Record<EquipmentCategory, string> = {
  red: 'RED EQUIPMENT',
  orange: 'ORANGE EQUIPMENT',
  green: 'GREEN EQUIPMENT',
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

const memberIcon = html`<svg
  class="sign__icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <circle cx="12" cy="8" r="3.5" />
  <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
</svg>`;

const tickIcon = html`<svg
  class="sign__icon"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <circle cx="12" cy="12" r="9" />
  <path d="m7.5 12.5 3 3 6-6.5" />
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

// A block on the sign: a code with the words that say what scanning it does,
// or - where there is nothing to scan, because the answer is the words
// themselves - the words alone, running the width of the capsule.
const scanBlock = (block: {
  qrUrl: O.Option<string>;
  variant: 'learn' | 'train' | 'fault' | 'notice';
  icon: Html;
  title: string;
  note: Html;
}) => html`
  <div class="sign__scan sign__scan--${safe(block.variant)}">
    ${pipe(
      block.qrUrl,
      O.match(
        () => html``,
        qrUrl => html`<div class="sign__qr">${qrCodeSvg(qrUrl, 200)}</div>`
      )
    )}
    <div class="sign__scan-text">
      <p class="sign__scan-title">${block.icon} ${safe(block.title)}</p>
      <p class="sign__scan-note">${block.note}</p>
      ${pipe(
        block.qrUrl,
        O.match(
          () => html``,
          qrUrl =>
            html`<p class="sign__url">
              ${sanitizeString(forReading(qrUrl))}
            </p>`
        )
      )}
    </div>
  </div>
`;

// The middle block is the one that depends on the colour: red equipment has
// training to get, orange has a rule to keep, and green has neither.
const trainingBlock = (sign: Sign) => {
  switch (sign.category) {
    case 'red':
      return scanBlock({
        qrUrl: sign.trainUrl,
        variant: 'train',
        icon: capIcon,
        title: 'Get trained',
        note: html`<b>You must be trained to use this equipment!</b> To get
          trained, pass the equipment quiz online and then attend an in-person
          training session.`,
      });
    case 'orange':
      return scanBlock({
        qrUrl: O.none,
        variant: 'notice',
        icon: memberIcon,
        title: 'Members only',
        note: html`You don't need formal training to use this equipment, but
          you do need to be a member of Makespace. Please only use it if you
          are confident to do so.${pipe(
            sign.areaEmail,
            O.match(
              () => html``,
              email =>
                html` Contact ${sanitizeString(email)} if you have any
                questions.`
            )
          )}`,
      });
    case 'green':
      return scanBlock({
        qrUrl: O.none,
        variant: 'notice',
        icon: tickIcon,
        title: 'Free to use!',
        note: html`This equipment requires no training and is free for all
          members and non-members to use.`,
      });
  }
};

const renderSign = (sign: Sign) => html`
  <div class="sign-block">
    <article class="sign sign--${safe(sign.category)}">
      <header class="sign__band">
        <p class="sign__band-word">${safe(CATEGORY_HEADING[sign.category])}</p>
        <p class="sign__band-rule">${categoryDescription(sign.category)}</p>
      </header>
      <h2 class="sign__name">${sanitizeString(sign.name)}</h2>
      <div class="sign__codes">
        ${scanBlock({
          qrUrl: O.some(sign.learnUrl),
          variant: 'learn',
          icon: bookIcon,
          title: 'Learn',
          note: html`What this equipment is for and how to use it.`,
        })}
        ${trainingBlock(sign)}
        ${scanBlock({
          qrUrl: O.some(sign.url),
          variant: 'fault',
          icon: spannerIcon,
          title: 'Trouble tickets',
          note: html`Report an issue with this equipment, or view what has
            already been reported and whether it's being worked on.`,
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
