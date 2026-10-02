import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Html, html, joinHtml, safe, sanitizeString} from '../../types/html';
import {
  Choice,
  DELIVERIES,
  deliveryLabel,
  happeningLabel,
  ScopeNode,
  TICKET_HAPPENINGS,
} from '../../trouble-tickets/notification-preferences';
import {ViewModel} from './view-model';

// Nothing is stored yet. The page exists so the shape of the settings can be
// argued with before it is written into the event timeline, where changing it
// afterwards is expensive.
const notYetSaving = html`
  <p class="ns-preview">
    A preview, so we can agree how this should work. Nothing you choose here is
    saved yet, and your notifications have not changed.
  </p>
`;

// What a rule comes to, said as a sentence. A row that inherits still has an
// effect, and the effect is the thing somebody is actually choosing.
const effectInWords = (choice: Choice): Html => {
  if (choice.delivery === 'never' || choice.happenings.length === 0) {
    return html`Nothing`;
  }
  const when =
    choice.delivery === 'as-it-happens'
      ? html`as it happens`
      : choice.delivery === 'daily'
        ? html`in a daily summary`
        : html`in a weekly summary`;
  const list = choice.happenings
    .map(happening => happeningLabel(happening).toLowerCase())
    .join(', ');
  return html`${sanitizeString(list)} &mdash; ${when}`;
};

const deliveryChoices = (scope: ScopeNode): Html => html`
  <select name="${safe(`delivery:${scope.id}`)}" class="ns-row__delivery">
    ${pipe(
      scope.inheritsFrom,
      O.match(
        () => html``,
        parent =>
          html`<option
            value="inherit"
            ${scope.setting.kind === 'inherit' ? safe('selected') : safe('')}
          >
            Same as ${sanitizeString(parent)}
          </option>`
      )
    )}
    ${joinHtml(
      DELIVERIES.map(
        delivery => html`
          <option
            value="${safe(delivery)}"
            ${scope.setting.kind === 'own' &&
            scope.setting.choice.delivery === delivery
              ? safe('selected')
              : safe('')}
          >
            ${sanitizeString(deliveryLabel(delivery))}
          </option>
        `
      )
    )}
  </select>
`;

const happeningChoices = (scope: ScopeNode): Html => html`
  <fieldset class="ns-row__happenings">
    <legend class="visually-hidden">
      What to hear about for ${sanitizeString(scope.label)}
    </legend>
    ${joinHtml(
      TICKET_HAPPENINGS.map(happening => {
        const id = `${scope.id}:${happening}`;
        return html`
          <label class="ns-check" for="${safe(id)}">
            <input
              type="checkbox"
              id="${safe(id)}"
              name="${safe(`happening:${scope.id}`)}"
              value="${safe(happening)}"
              ${scope.setting.kind === 'own' &&
              scope.setting.choice.happenings.includes(happening)
                ? safe('checked')
                : safe('')}
              ${scope.setting.kind === 'inherit' ? safe('disabled') : safe('')}
            />
            ${sanitizeString(happeningLabel(happening))}
          </label>
        `;
      })
    )}
  </fieldset>
`;

const row = (scope: ScopeNode, depth: number): Html => html`
  <li class="ns-row ns-row--depth-${safe(String(Math.min(depth, 3)))}">
    <div class="ns-row__head">
      <span class="ns-row__label">${sanitizeString(scope.label)}</span>
      ${pipe(
        scope.note,
        O.match(
          () => html``,
          note => html`<span class="ns-row__why">${sanitizeString(note)}</span>`
        )
      )}
      <span class="ns-row__effect">${effectInWords(scope.effective)}</span>
    </div>
    <div class="ns-row__controls">
      ${deliveryChoices(scope)}
      ${scope.setting.kind === 'inherit' ? html`` : happeningChoices(scope)}
    </div>
    ${scope.children.length === 0
      ? html``
      : html`<ul class="ns-children">
          ${joinHtml(scope.children.map(child => row(child, depth + 1)))}
        </ul>`}
  </li>
`;

const nothingToScope = (viewModel: ViewModel): Html =>
  viewModel.isOwner || viewModel.isTrainer
    ? html``
    : html`<p>
        You do not own an area or train on any equipment, so the only rules
        that apply to you are the two above. They will grow a branch each when
        you do.
      </p>`;

export const render = (viewModel: ViewModel): Html => html`
  <div class="stack">
    <h1>Trouble ticket notifications</h1>
    ${notYetSaving}
    <p>
      Each rule below either follows the one above it or says its own thing.
      Set it once at the top to go quiet everywhere, or pick out a single
      machine you want to hear about whatever else you have chosen.
    </p>
    <p>
      <strong
        >${safe(String(viewModel.soundingCount))} of these currently send you
        something.</strong
      >
    </p>
    <ul class="ns-tree">
      ${joinHtml(viewModel.scopes.map(scope => row(scope, 0)))}
    </ul>
    ${nothingToScope(viewModel)}
    <p>
      <small
        >A machine in an area you own follows that area unless you say
        otherwise. A machine you train on follows "Equipment I train on", which
        is a separate branch because teaching on something and owning the area
        it sits in do not always go together.</small
      >
    </p>
  </div>
`;
