import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Html, html, joinHtml, safe, sanitizeString} from '../../types/html';
import {
  Choice,
  ScopeNode,
  SUBSCRIPTIONS,
  subscriptionLabel,
} from '../../trouble-tickets/notification-preferences';
import {ViewModel} from './view-model';

// What a rule comes to, said as a sentence. A row that inherits still has an
// effect, and the effect is the thing somebody is actually choosing.
const shownChoice = (scope: ScopeNode): Choice =>
  scope.setting.kind === 'own' ? scope.setting.choice : scope.effective;

const isFollowing = (scope: ScopeNode): boolean =>
  scope.setting.kind === 'inherit' && O.isSome(scope.inheritsFrom);

// Four options, each saying what it means. A rule asks one question now, so
// there is nothing to group or label beyond the row's own name.
const subscriptionChoices = (scope: ScopeNode): Html => html`
  ${O.isSome(scope.inheritsFrom)
    ? html`<input
        type="hidden"
        name="${safe(`subscription:${scope.id}`)}"
        value="follow"
        data-ns-follow-field
        ${isFollowing(scope) ? safe('') : safe('disabled')}
      />`
    : html``}
  <fieldset
    class="ns-row__subscription"
    ${isFollowing(scope) ? safe('disabled') : safe('')}
  >
    <legend class="visually-hidden">
      Notifications for ${sanitizeString(scope.label)}
    </legend>
    ${joinHtml(
      SUBSCRIPTIONS.map(subscription => {
        const id = `${scope.id}:${subscription}`;
        return html`
          <label class="ns-option" for="${safe(id)}">
            <input
              type="radio"
              id="${safe(id)}"
              name="${safe(`subscription:${scope.id}`)}"
              value="${safe(subscription)}"
              ${shownChoice(scope) === subscription
                ? safe('checked')
                : safe('')}
            />
            <span class="ns-option__label"
              >${sanitizeString(subscriptionLabel(subscription))}</span
            >
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

const heading = (depth: number, inner: Html): Html => {
  if (depth === 0) {
    return html`<h2 class="ns-row__label">${inner}</h2>`;
  }
  return depth === 1
    ? html`<h3 class="ns-row__label">${inner}</h3>`
    : html`<h4 class="ns-row__label">${inner}</h4>`;
};

const row = (scope: ScopeNode, depth: number): Html => html`
  <li class="ns-row ns-row--depth-${safe(String(Math.min(depth, 2)))}">
    <div class="ns-row__head">
      ${heading(depth, html`${sanitizeString(scope.label)}`)}
    </div>
    <div
      class="ns-row__controls ${isFollowing(scope)
        ? safe('ns-row__controls--following')
        : safe('')}"
      data-ns-controls
    >
      ${followSwitch(scope)} ${subscriptionChoices(scope)}
    </div>
    ${scope.children.length === 0
      ? html``
      : depth === 0
        ? html`
            <details class="ns-areas" ${scope.kind === 'my-areas' ? safe('open') : safe('')}>
              <summary>
                View specific areas
                (${sanitizeString(String(scope.children.length))})
              </summary>
              <ul class="ns-children" data-ns-children>
                ${joinHtml(scope.children.map(child => row(child, depth + 1)))}
              </ul>
            </details>
          `
        : html`
          ${isFollowing(scope)
            ? html`<p class="ns-row__folded" data-ns-folded-note>
                ${sanitizeString(String(scope.children.length))}
                ${scope.children.length === 1
                  ? html`machine here follows`
                  : html`machines here follow`}
                this.
              </p>`
            : html``}
          <ul
            class="ns-children ${isFollowing(scope)
              ? safe('ns-children--folded')
              : safe('')}"
            data-ns-children
          >
            ${joinHtml(scope.children.map(child => row(child, depth + 1)))}
          </ul>
        `}
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
    <p>
      <strong
        >${safe(String(viewModel.soundingCount))} of these currently send you
        something.</strong
      >
    </p>
    <form method="post" action="/notification-settings" class="stack">
      <ul class="ns-tree">
        ${joinHtml(viewModel.scopes.map(scope => row(scope, 0)))}
      </ul>
      <p><button type="submit">Save</button></p>
    </form>
    <script>
      // Turning a row's own controls on and off. Scoped to the controls block
      // the switch sits in, because a row contains its children's rows and a
      // loose query would reach into them.
      (function () {
        document.querySelectorAll('[data-ns-differ]').forEach(function (differ) {
          var controls = differ.closest('[data-ns-controls]');
          if (!controls) return;
          var own = controls.querySelectorAll('select, fieldset');
          var followField = controls.querySelector('[data-ns-follow-field]');
          var row = controls.parentElement;
          var kids = row
            ? Array.prototype.find.call(row.children, function (child) {
                return child.matches('[data-ns-children]');
              })
            : null;
          var foldedNote = row
            ? Array.prototype.find.call(row.children, function (child) {
                return child.matches('[data-ns-folded-note]');
              })
            : null;
          var apply = function () {
            controls.classList.toggle(
              'ns-row__controls--following',
              !differ.checked
            );
            if (kids) {
              kids.classList.toggle('ns-children--folded', !differ.checked);
            }
            if (foldedNote) {
              foldedNote.hidden = differ.checked;
            }
            Array.prototype.forEach.call(own, function (control) {
              control.disabled = !differ.checked;
            });
            // A following row sends 'follow' rather than nothing, so that
            // going back to following clears what was stored instead of
            // leaving the old answer in place.
            if (followField) {
              followField.disabled = differ.checked;
            }
          };
          differ.addEventListener('change', apply);
          apply();
        });
      })();
    </script>
    ${nothingToScope(viewModel)}
  </div>
`;
