import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {
  commaHtml,
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import {formatPence} from '../../types/money';
import {definedTerm} from '../shared-render/defined-term';
import {GuideSection, guideSections, SubsectionId} from './sections';
import {
  PurchasingAreaOfYours,
  ViewModel,
  YourAreas,
} from './construct-view-model';
import {logInPath} from '../../authentication/login/routes';

// Whole pounds without the pence: "£1,000", not "£1,000.00".
const money = (pence: number) =>
  sanitizeString(formatPence(pence).replace(/\.00$/, ''));

// What's left, and a thin bar of how much of the year's budget is spent:
// full and orange once overspent.
const budget = (purchasingArea: PurchasingAreaOfYours) => {
  const {yearlyBudgetPence, remainingPence} = purchasingArea;
  const spentShare =
    yearlyBudgetPence <= 0
      ? 1
      : Math.min(
          1,
          Math.max(0, (yearlyBudgetPence - remainingPence) / yearlyBudgetPence)
        );
  const overspent = remainingPence < 0;
  return html`
    ${overspent
      ? html`<span class="budget-overspent"
          >${money(-remainingPence)} over</span
        >`
      : html`${money(remainingPence)} left`}
    <span class="owners-guide__muted">of ${money(yearlyBudgetPence)}</span>
    <span class="owners-guide__bar" aria-hidden="true"
      ><span
        class="owners-guide__bar-spent${safe(
          overspent ? ' owners-guide__bar-spent--over' : ''
        )}"
        style="width: ${safe((spentShare * 100).toFixed(1))}%"
      ></span
    ></span>
  `;
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
];

// This year's spending month by month, January at the left: a bar a month,
// its height the month's spend, and nothing yet for months still to come so
// every row's months line up. Hovering a bar says what it was.
const SPARK_BAR = 5;
const SPARK_GAP = 2;
const SPARK_HEIGHT = 16;

const spendSparkline = (
  spentByMonthPence: ReadonlyArray<number>,
  monthNow: number
) => {
  const most = Math.max(1, ...spentByMonthPence);
  const width = 12 * SPARK_BAR + 11 * SPARK_GAP;
  const bars = spentByMonthPence.slice(0, monthNow).map((pence, i) => {
    const height =
      pence === 0
        ? 1
        : Math.max(2, Math.round(((SPARK_HEIGHT - 1) * pence) / most));
    return html`<rect
      class="owners-guide__spark${safe(pence === 0 ? ' owners-guide__spark--none' : '')}"
      x="${safe(String(i * (SPARK_BAR + SPARK_GAP)))}"
      y="${safe(String(SPARK_HEIGHT - height))}"
      width="${safe(String(SPARK_BAR))}"
      height="${safe(String(height))}"
      ><title>${safe(monthNames[i])}: ${money(pence)}</title></rect
    >`;
  });
  return html`<svg
    class="owners-guide__sparkline"
    width="${safe(String(width))}"
    height="${safe(String(SPARK_HEIGHT))}"
    viewBox="0 0 ${safe(String(width))} ${safe(String(SPARK_HEIGHT))}"
    role="img"
    aria-label="Spending each month this year"
  >
    ${joinHtml(bars)}
  </svg>`;
};

const activity = (purchasingArea: PurchasingAreaOfYours, monthNow: number) =>
  html`${safe(String(purchasingArea.purchasesThisYear))}
    purchase${safe(purchasingArea.purchasesThisYear === 1 ? '' : 's')}
    ${spendSparkline(purchasingArea.spentByMonthPence, monthNow)}`;

// Your areas in it go under the name, so the table needs only three columns
// beside the text; on a phone each row becomes a small block, labelled.
const purchaseAreaRow =
  (monthNow: number) => (purchasingArea: PurchasingAreaOfYours) => html`
  <tr>
    <td>
      <a href="/purchasing-areas/${safe(purchasingArea.id)}"
        >${sanitizeString(purchasingArea.name)}</a
      >
      <span class="owners-guide__your-areas owners-guide__muted"
        >${purchasingArea.active ? html`` : html`<em>Not active yet.</em> `}Your
        areas:
        ${commaHtml(
          purchasingArea.yourAreas.map(name => sanitizeString(name))
        )}</span
      >
    </td>
    <td data-label="This year">${activity(purchasingArea, monthNow)}</td>
    <td data-label="Budget this year" class="owners-guide__money">
      ${budget(purchasingArea)}
    </td>
  </tr>
`;

// Where the guide draws on the app's data about the reader: their own
// areas when logged in; otherwise a dotted box saying what logging in would
// show, linking to log in and come back to the same section.
const yourData = (
  viewModel: ViewModel,
  sectionId: GuideSection['id'],
  whatLoggingInShows: string,
  render: (yours: YourAreas) => Html
) =>
  pipe(
    viewModel.reader,
    O.match(
      () => html`
        <p class="owners-guide__log-in-to-see">
          <a
            href="${logInPath}?next=${safe(
              encodeURIComponent(`/owners-guide#${sectionId}`)
            )}"
            >Log in</a
          >
          to view ${sanitizeString(whatLoggingInShows)}.
        </p>
      `,
      render
    )
  );

// The reader's Purchase Areas: which of their areas each covers, its
// Purchasers and this year's budget. Says nothing to somebody who owns no
// areas, rather than an empty table.
const yourPurchaseAreas = (yours: YourAreas) =>
  yours.purchasingAreas.length === 0 &&
  yours.withoutPurchasingArea.length === 0
    ? html``
    : html`
        <section class="owners-guide__yours" aria-labelledby="your-purchase-areas">
          <p class="owners-guide__yours-heading" id="your-purchase-areas">
            <strong>Your Purchase Areas</strong>
          </p>
          ${yours.purchasingAreas.length === 0
            ? html``
            : html`<table>
                <thead>
                  <tr>
                    <th scope="col">Purchase Area</th>
                    <th scope="col">This year</th>
                    <th scope="col" class="owners-guide__money">
                      Budget this year
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${joinHtml(yours.purchasingAreas.map(purchaseAreaRow(yours.monthNow)))}
                </tbody>
              </table>`}
          ${yours.withoutPurchasingArea.length === 0
            ? html``
            : html`<p>
                Not in a Purchase Area yet:
                ${commaHtml(
                  yours.withoutPurchasingArea.map(name => sanitizeString(name))
                )}.
              </p>`}
        </section>
      `;

const stillBeingWritten = html`
  <p class="owners-guide__placeholder">
    This section is still being written.
  </p>
`;

// Who approves and pays for an area's requests, when it has nominated
// anybody: by name, as elsewhere in the guide, or member number without one.
const purchasersOf = (purchasingArea: PurchasingAreaOfYours) =>
  purchasingArea.purchasers.length === 0
    ? html``
    : html`<span class="owners-guide__purchasers owners-guide__muted"
        >${safe(
          purchasingArea.purchasers.length === 1 ? 'Purchaser' : 'Purchasers'
        )}:
        ${commaHtml(
          purchasingArea.purchasers.map(purchaser =>
            pipe(
              purchaser.name,
              O.match(
                () => html`member ${safe(String(purchaser.memberNumber))}`,
                name => html`${sanitizeString(name)}`
              )
            )
          )
        )}</span
      >`;

// Where to request a purchase for each of the reader's Purchase Areas: only
// an active one takes requests. Says nothing to somebody in no Purchase Area.
const requestAPurchase = (yours: YourAreas) =>
  yours.purchasingAreas.length === 0
    ? html``
    : html`
        <section
          class="owners-guide__yours"
          aria-labelledby="request-a-purchase"
        >
          <p class="owners-guide__yours-heading" id="request-a-purchase">
            <strong>Request a purchase</strong>
          </p>
          <ul class="owners-guide__requests">
            ${joinHtml(
              yours.purchasingAreas.map(
                purchasingArea => html`<li>
                  ${purchasingArea.active
                    ? html`${sanitizeString(purchasingArea.name)} -
                        <a
                          href="/purchase-requests/submit?purchasingArea=${safe(
                            encodeURIComponent(purchasingArea.id)
                          )}"
                          >request a purchase</a
                        >
                        ${purchasersOf(purchasingArea)}`
                    : html`${sanitizeString(purchasingArea.name)}
                        <span class="owners-guide__muted"
                          >isn't taking requests yet. If you want your Area to
                          adopt the system, email
                          <a href="mailto:managers@makespace.org"
                            >managers@makespace.org</a
                          ></span
                        >`}
                </li>`
              )
            )}
          </ul>
        </section>
      `;

// What the guide's defined terms mean, shown on hover wherever one is used.
const definitions = {
  'purchase-area':
    "Purchase Area: a collection of Areas that share a budget and make purchasing decisions collectively, authorised and actioned by their Purchaser. Its Yearly Budget is its Areas' yearly allowances added together.",
  'yearly-budget':
    "Yearly Budget: a single budget for all of a Purchase Area's maintenance, improvements and non-recoverable consumables. Every Area is allocated the same yearly allowance (£1000 for 2027, which can change year to year), and a Purchase Area's Yearly Budget is its Areas' allowances added together, plus any Expanded Allowance. It's designed to give Owners flexibility over how they spend money, and isn't a target.",
  'small-purchase-amount':
    "Small Purchase Amount: a single purchase costing this much or more needs a proposal, even when it's within the Yearly Budget. It's normally £1000.",
  'expanded-allowance':
    "Expanded Allowance: extra budget for a year, approved by the directors, for spending an Area can already foresee that its yearly allowance won't cover. Ask for one by emailing the managers and directors with what the expected spends are and why they're needed - ideally before the financial year starts, but you can ask at any time.",
  maintenance:
    'Maintenance: keeping your Area running - routine services (e.g. replacing the Laser Cutter filters), unplanned repairs (e.g. a broken band saw blade) and like-for-like replacements (e.g. a new jigsaw).',
  improvements:
    'Improvements: expanding the functionality of your Area, including entirely new equipment and upgrading existing equipment with a replacement.',
  'non-recoverable-consumables':
    "Non-recoverable consumables: consumables members don't pay for when they use them, e.g. embroidery machine thread or solder.",
  'recoverable-consumables':
    'Recoverable consumables: consumables members pay for when they use them, e.g. laser materials or 3D printer filament.',
  manager:
    'Manager: paid contractors who act as a coordinating function across Makespace, ensuring the smooth operation of the day-to-day running of the space, coordinating among the owners teams, guiding members to whatever/whoever they need, and coordinating between the directors and owners/members.',
  director:
    'Director: members who have taken on a voluntary role of being ultimately liable for the safety and sustainability of Makespace. Their role is to be answerable to the general membership.',
  'purchase-request':
    'Purchase Request: a request for a purchase. What do you want to buy, where are we buying it from, how much does it cost, what are the considerations that need to be taken into account? These can be made in any format, but there is a helpful form built into the Purchase Area system to make it as simple as possible.',
  purchaser:
    'Purchaser: an Owner who has taken on the role of approving purchases, actioning them, and tracking the budget for a Purchase Area.',
} as const;

// A term underlined each time it's used, not only the first: each use gets
// its own id, so its meaning is tied to that use.
const termsFor = () => {
  let uses = 0;
  return (key: keyof typeof definitions, text: string) =>
    definedTerm(
      `term-${key}-${(uses += 1)}`,
      html`${sanitizeString(text)}`,
      definitions[key]
    );
};

// A heading within a section, with the id the contents link to; its title
// comes from the same list as the contents', so the two always agree.
const subheading = (id: SubsectionId) => {
  const found = guideSections
    .flatMap(section => [...section.subsections])
    .find(subsection => subsection.id === id);
  return html`<h3 id="${safe(id)}" class="owners-guide__subheading">
    ${safe(found?.title ?? id)}
  </h3>`;
};

// The written part of each topic, by section id. A topic with nothing here yet
// says so, so the cards on the owner page still land somewhere.
const bodies = (
  viewModel: ViewModel
): Partial<Record<GuideSection['id'], Html>> => {
  const term = termsFor();
  return {
    purchasing: html`
      <p>Money is available for Owners' teams to pay for:</p>
      <ul class="owners-guide__kinds">
        <li>
          <strong>Maintenance</strong>
          <span
            >Routine services (e.g. the Laser Cutters need filters replacing),
            unplanned repairs (e.g. someone broke the band saw blade) and
            like-for-like replacements (e.g. a new jigsaw)</span
          >
        </li>
        <li>
          <strong>Improvements</strong>
          <span
            >Expanding the functionality of your Area, including entirely new
            equipment and upgrading existing equipment with a replacement</span
          >
        </li>
        <li>
          <strong>Non-recoverable consumables</strong>
          <span>Such as embroidery machine thread or solder</span>
        </li>
      </ul>
      <p>
        Recoverable consumables are paid for by members when they use them
        (e.g. laser materials, 3D printer filament), so they sit outside of
        this.
      </p>
      <p>
        Every Area is allocated the same yearly allowance: £1000 for 2027,
        which can change year to year. Areas are grouped into
        ${term('purchase-area', 'Purchase Areas')} when they often make
        financial decisions together, and a
        ${term('purchase-area', 'Purchase Area')}'s
        ${term('yearly-budget', 'Yearly Budget')} is its Areas' allowances
        combined. This gives owners a low friction way to make simple
        purchases.
      </p>
      ${yourData(
        viewModel,
        'purchasing',
        'the Purchase Areas that you are an Owner in',
        yourPurchaseAreas
      )}
      ${subheading('purchasing-decisions')}
      <p>
        To suggest a purchase within your
        ${term('purchase-area', 'Purchase Area')}, you can use the
        ${term('purchase-request', 'Purchase Request')} system.
      </p>
      ${yourData(
        viewModel,
        'purchasing',
        'links to request purchases for your Purchase Areas',
        requestAPurchase
      )}
      <p>
        ${term('purchase-area', 'Purchase Areas')} can nominate a
        ${term('purchaser', 'Purchaser')} to approve
        ${term('purchase-request', 'Purchase Requests')}, and this person will
        be given the ability to make the purchase with a Capital on Tap card.
        ${term('manager', 'Managers')} are also able to make purchases if no
        ${term('purchaser', 'Purchaser')} is nominated or if a purchase exceeds
        a card limit.
      </p>
      ${subheading('simple-purchases')}
      <p>
        The Owners in a ${term('purchase-area', 'Purchase Area')} have full
        autonomy to decide on ${term('purchase-request', 'Purchase Requests')}
        that:
      </p>
      <ul class="owners-guide__conditions">
        <li class="owners-guide__condition owners-guide__condition--money">
          <i class="fa-regular fa-money-bill-1" aria-hidden="true"></i>
          <span>Aren't over the
          ${term('small-purchase-amount', 'Small Purchase Amount')} (normally
          £1000)</span>
        </li>
        <li class="owners-guide__condition owners-guide__condition--money">
          <i class="fa-regular fa-money-bill-1" aria-hidden="true"></i>
          <span>Don't take the ${term('purchase-area', 'Purchase Area')} over its
          ${term('yearly-budget', 'Yearly Budget')}</span>
        </li>
        <li class="owners-guide__condition owners-guide__condition--care">
          <i class="fa-regular fa-comment" aria-hidden="true"></i>
          <span>Won't potentially negatively impact other Areas</span>
        </li>
        <li class="owners-guide__condition owners-guide__condition--care">
          <i class="fa-regular fa-comment" aria-hidden="true"></i>
          <span>Won't potentially introduce a moderate to high health &amp; safety
          risk</span>
        </li>
      </ul>
      <p>
        All other ${term('purchase-request', 'Purchase Requests')} need an
        accompanying Proposal.
      </p>
      ${subheading('proposals')}
      <p>
        You can submit a Proposal as part of your
        ${term('purchase-request', 'Purchase Request')}, including pros/cons,
        options considered and a risk assessment if necessary.
      </p>
      <ul class="owners-guide__conditions">
        <li class="owners-guide__condition owners-guide__condition--care">
          <i class="fa-regular fa-comment" aria-hidden="true"></i>
          <span
            >Proposals that impact multiple areas can be discussed at Owners
            Meetings, or conversations can be facilitated by
            ${term('manager', 'managers')}.</span
          >
        </li>
        <li class="owners-guide__condition owners-guide__condition--care">
          <i class="fa-regular fa-comment" aria-hidden="true"></i>
          <span
            >Proposals that potentially introduce health &amp; safety risks
            need to be signed off by ${term('director', 'Directors')} at a
            Board Meeting.</span
          >
        </li>
      </ul>
      ${subheading('budgets')}
      <p>
        A ${term('purchase-area', 'Purchase Area')} has a single
        ${term('yearly-budget', 'Yearly Budget')} for all types of spending:
        ${term('maintenance', 'Maintenance')},
        ${term('improvements', 'Improvements')} and
        ${term('non-recoverable-consumables', 'Non-recoverable consumables')}
        all come out of it.
      </p>
      <p>
        ${term('recoverable-consumables', 'Recoverable consumables')} are paid
        for by members when they are used, so they do not come out of the
        ${term('yearly-budget', 'Yearly Budget')}.
      </p>
      ${subheading('over-budget')}
      <p>
        Budgets are indicative only, meant to reduce friction. They aren't
        designed to be a hard limit on an Area's spending and they're not
        designed to be a target either!
      </p>
      <p>
        If a ${term('purchase-area', 'Purchase Area')} exceeds its budget, new
        ${term('purchase-request', 'purchase requests')} will have to be
        approved by the board of ${term('director', 'directors')}.
      </p>
      <p>
        If your Area's yearly allowance won't be enough for the maintenance,
        improvements and non-recoverable consumables you can already foresee,
        you can ask for an
        ${term('expanded-allowance', 'Expanded Allowance')}. Email the
        ${term('manager', 'managers')} and ${term('director', 'directors')}
        saying what the expected spends are and why they're needed, for the
        ${term('director', 'directors')} to approve. Ideally ask before the
        financial year starts (1 January), but you can ask at any time.
      </p>
      <p>
        An ${term('expanded-allowance', 'Expanded Allowance')} keeps your
        yearly allowance free for discretionary spending that doesn't need
        approval. Individual purchases still go through
        ${term('purchase-request', 'Purchase Requests')} as usual.
      </p>
    `,
  };
};

const sectionPart = (viewModel: ViewModel) => (section: GuideSection) => html`
  <section id="${safe(section.id)}" class="owners-guide__section stack">
    <h2>
      <i class="fa-regular ${safe(section.icon)}" aria-hidden="true"></i>
      ${safe(section.title)}
    </h2>
    <p class="owners-guide__summary">${safe(section.summary)}</p>
    ${bodies(viewModel)[section.id] ?? stillBeingWritten}
  </section>
`;

export const render = (viewModel: ViewModel) => html`
  <div class="owners-guide">
    <nav class="owners-guide__toc" aria-label="Contents">
      <h2 class="owners-guide__toc-heading">Contents</h2>
      <ol>
        ${joinHtml(
          guideSections.map(
            section =>
              html`<li>
                <a href="#${safe(section.id)}">${safe(section.title)}</a>
                ${section.subsections.length === 0
                  ? html``
                  : html`<ol class="owners-guide__toc-sub">
                      ${joinHtml(
                        section.subsections.map(
                          subsection =>
                            html`<li>
                              <a href="#${safe(subsection.id)}"
                                >${safe(subsection.contents)}</a
                              >
                            </li>`
                        )
                      )}
                    </ol>`}
              </li>`
          )
        )}
      </ol>
    </nav>
    <div class="owners-guide__body stack-large">
      <div class="stack">
        <h1>Owner's guide</h1>
        <p>
          How to get things done for the areas and equipment you look after.
        </p>
      </div>
      ${joinHtml(guideSections.map(sectionPart(viewModel)))}
    </div>
  </div>
`;
