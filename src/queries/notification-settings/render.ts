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

// A following row shows the settings it is following, greyed and turned off,
// rather than a sentence naming its parent. Somebody deciding whether to
// differ wants to see what they would be differing from.
const shownChoice = (scope: ScopeNode): Choice =>
  scope.setting.kind === 'own' ? scope.setting.choice : scope.effective;

const isFollowing = (scope: ScopeNode): boolean =>
  scope.setting.kind === 'inherit' && O.isSome(scope.inheritsFrom);

const deliveryChoices = (scope: ScopeNode): Html => html`
  <div class="ns-row__group">
    <label class="ns-row__group-label" for="${safe(`delivery:${scope.id}`)}"
      >How often</label
    >
    <select
      id="${safe(`delivery:${scope.id}`)}"
      name="${safe(`delivery:${scope.id}`)}"
      class="ns-row__delivery"
      ${isFollowing(scope) ? safe('disabled') : safe('')}
    >
    ${joinHtml(
      DELIVERIES.map(
        delivery => html`
          <option
            value="${safe(delivery)}"
            ${shownChoice(scope).delivery === delivery
              ? safe('selected')
              : safe('')}
          >
            ${sanitizeString(deliveryLabel(delivery))}
          </option>
        `
      )
    )}
    </select>
  </div>
`;

const happeningChoices = (scope: ScopeNode): Html => html`
  <fieldset
    class="ns-row__happenings"
    ${isFollowing(scope) ? safe('disabled') : safe('')}
  >
    <legend class="ns-row__group-label">
      Tell me about<span class="visually-hidden">
        &mdash; ${sanitizeString(scope.label)}</span
      >
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
              ${shownChoice(scope).happenings.includes(happening)
                ? safe('checked')
                : safe('')}
            />
            ${sanitizeString(happeningLabel(happening))}
          </label>
        `;
      })
    )}
  </fieldset>
`;

// The switch between following and differing. A checkbox rather than an option
// inside the delivery list: following is not a kind of delivery, and mixing
// the two made "Same as Wood Shop" sit beside "Daily summary" as though they
// answered the same question.
const followSwitch = (scope: ScopeNode): Html =>
  pipe(
    scope.inheritsFrom,
    O.match(
      () => html``,
      parent => html`
        <label class="ns-row__differ" for="${safe(`differ:${scope.id}`)}">
          <input
            type="checkbox"
            id="${safe(`differ:${scope.id}`)}"
            name="${safe(`differ:${scope.id}`)}"
            data-ns-differ
            ${scope.setting.kind === 'own' ? safe('checked') : safe('')}
          />
          <span
            >Set differently from
            <strong>${sanitizeString(parent)}</strong></span
          >
        </label>
      `
    )
  );

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
    <div
      class="ns-row__controls ${isFollowing(scope)
        ? safe('ns-row__controls--following')
        : safe('')}"
      data-ns-controls
    >
      ${followSwitch(scope)} ${happeningChoices(scope)}
      ${deliveryChoices(scope)}
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
    <script>
      // Turning a row's own controls on and off. Scoped to the controls block
      // the switch sits in, because a row contains its children's rows and a
      // loose query would reach into them.
      (function () {
        document.querySelectorAll('[data-ns-differ]').forEach(function (differ) {
          var controls = differ.closest('[data-ns-controls]');
          if (!controls) return;
          var own = controls.querySelectorAll('select, fieldset');
          var apply = function () {
            controls.classList.toggle(
              'ns-row__controls--following',
              !differ.checked
            );
            Array.prototype.forEach.call(own, function (control) {
              control.disabled = !differ.checked;
            });
          };
          differ.addEventListener('change', apply);
          apply();
        });
      })();
    </script>
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
