import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {User} from '../../types';
import {ownerAgreementPages} from './owner-agreement';

// The agreement is long, so it is read a page at a time (?step=1, ?step=2,
// ...) to slow people down, with the sign button only on the last page.
//
// On the responsibility pages the member picks the responsibilities they're
// interested in, and must pick at least one to move on. Their picks travel
// in the query string (each page's Next is a GET form), and every request is
// checked: asking for a page beyond one still waiting for a pick shows that
// page instead, so editing ?step= in the URL can't skip ahead.

type ChoiceName = 'equipment' | 'area';

type Selections = Readonly<Record<ChoiceName, ReadonlyArray<string>>>;

type ViewModel = {
  user: User;
  step: number;
  selections: Selections;
  // They asked for a later page but this one still needs a pick
  sentBack: boolean;
};

const pageCount = ownerAgreementPages.length;

const choiceNames: ReadonlyArray<ChoiceName> = ['equipment', 'area'];

const selectionPairs = (selections: Selections, except?: ChoiceName) =>
  choiceNames
    .filter(name => name !== except)
    .flatMap(name => selections[name].map(value => [name, value] as const));

const stepLink = (step: number, selections: Selections) => {
  const query = new URLSearchParams({step: String(step)});
  selectionPairs(selections).forEach(([name, value]) =>
    query.append(name, value)
  );
  return sanitizeString(`?${query.toString()}`);
};

const hiddenInputs = (pairs: ReadonlyArray<readonly [string, string]>) =>
  joinHtml(
    pairs.map(
      ([name, value]) =>
        html`<input
          type="hidden"
          name="${sanitizeString(name)}"
          value="${sanitizeString(value)}"
        />`
    )
  );

const renderProgress = (current: number, selections: Selections) => html`
  <nav class="agreement-progress" aria-label="Agreement progress">
    <p class="agreement-progress__count">Page ${current} of ${pageCount}</p>
    <ol class="agreement-progress__steps">
      ${joinHtml(
        ownerAgreementPages.map(({label}, index) => {
          const step = index + 1;
          if (step < current) {
            return html`
              <li class="agreement-progress__step agreement-progress__step--done">
                <a href="${stepLink(step, selections)}">
                  <span class="agreement-progress__marker" aria-hidden="true"
                    >✓</span
                  >
                  <span class="agreement-progress__label"
                    >${safe(label)}<span class="visually-hidden">
                      (read)</span
                    ></span
                  >
                </a>
              </li>
            `;
          }
          return html`
            <li
              class="agreement-progress__step agreement-progress__step--${safe(
                step === current ? 'current' : 'todo'
              )}"
              ${step === current ? safe('aria-current="step"') : ''}
            >
              <span class="agreement-progress__marker" aria-hidden="true"
                >${step}</span
              >
              <span class="agreement-progress__label">${safe(label)}</span>
            </li>
          `;
        })
      )}
    </ol>
  </nav>
`;

const renderBack = ({step, selections}: ViewModel) =>
  step > 1
    ? html`<a href="${stepLink(step - 1, selections)}">Back</a>`
    : html``;

const renderNav = (viewModel: ViewModel) => html`
  <div class="agreement-nav">
    ${renderBack(viewModel)}
    <button type="submit">
      Next: ${safe(ownerAgreementPages[viewModel.step].label)}
    </button>
  </div>
`;

const renderChoices = (viewModel: ViewModel) => {
  const {choices} = ownerAgreementPages[viewModel.step - 1];
  if (!choices) {
    return html``;
  }
  const picked = viewModel.selections[choices.name];
  return html`
    <fieldset class="agreement-choices__set">
      <legend class="agreement-choices__prompt">
        Select the responsibilities you're interested in taking on. Choose at
        least one to continue.
      </legend>
      ${viewModel.sentBack
        ? html`<div class="callout callout--red" role="alert">
            <p>
              Please choose at least one responsibility you're interested in
              before moving on.
            </p>
          </div>`
        : html``}
      <ul class="card-grid">
        ${joinHtml(
          choices.responsibilities.map(
            responsibility => html`
              <li>
                <label class="card-choice">
                  <input
                    type="checkbox"
                    class="visually-hidden"
                    name="${safe(choices.name)}"
                    value="${safe(responsibility.value)}"
                    ${picked.includes(responsibility.value)
                      ? safe('checked')
                      : ''}
                  />
                  <span class="card-choice__check" aria-hidden="true"></span>
                  <strong class="card-title"
                    ><i
                      class="fa-regular ${safe(responsibility.icon)}"
                      aria-hidden="true"
                    ></i>
                    ${safe(responsibility.title)}</strong
                  >
                  ${responsibility.description}
                </label>
              </li>
            `
          )
        )}
      </ul>
    </fieldset>
  `;
};

// Every page but the last moves on with a GET form, carrying the picks so
// far; a responsibility page's own picks come from its checkboxes.
const renderNext = (viewModel: ViewModel) => {
  const {choices} = ownerAgreementPages[viewModel.step - 1];
  return html`
    <form method="get" class="agreement-choices">
      <input type="hidden" name="step" value="${viewModel.step + 1}" />
      ${hiddenInputs(selectionPairs(viewModel.selections, choices?.name))}
      ${renderChoices(viewModel)} ${renderNav(viewModel)}
    </form>
  `;
};

const renderSign = (viewModel: ViewModel) => html`
  <div class="callout callout--green">
    <p>
      By signing this agreement you're confirming that you understand the
      responsibilities of ownership and want to take an active role in your
      area.
    </p>
    <form action="?next=/me" method="post">
      <input
        type="hidden"
        name="memberNumber"
        value="${viewModel.user.memberNumber}"
      />
      <input
        type="hidden"
        name="signedAt"
        value="${safe(new Date().toISOString())}"
      />
      <button type="submit">Sign the Owners’ Agreement</button>
    </form>
  </div>
  <div class="agreement-nav">${renderBack(viewModel)}</div>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack prose">
        <h1>The Owners’ Agreement</h1>
        ${renderProgress(viewModel.step, viewModel.selections)}
        ${ownerAgreementPages[viewModel.step - 1].body}
        ${viewModel.step === pageCount
          ? renderSign(viewModel)
          : renderNext(viewModel)}
      </div>
    `,
    toLoggedInContent(safe('Sign Owner Agreement'))
  );

// Anything missing or out of range starts from the first page.
const readRequestedStep = (input: unknown) =>
  pipe(
    input,
    t.type({step: tt.IntFromString}).decode,
    E.map(({step}) => step),
    E.filterOrElseW(
      step => step >= 1 && step <= pageCount,
      () => null
    ),
    E.getOrElse(() => 1)
  );

// A single pick arrives as a string, several as an array; anything that isn't
// one of the page's responsibilities is dropped.
const readSelection = (input: unknown, name: ChoiceName) => {
  const valid = ownerAgreementPages.flatMap(({choices}) =>
    choices?.name === name
      ? choices.responsibilities.map(({value}) => value)
      : []
  );
  return pipe(
    input,
    t.type({[name]: t.union([t.string, t.array(t.string)])}).decode,
    E.map(decoded => ([] as string[]).concat(decoded[name])),
    E.map(values => valid.filter(value => values.includes(value))),
    E.getOrElse((): ReadonlyArray<string> => [])
  );
};

// The furthest page they can be on: the first responsibility page still
// waiting for a pick, or the last page once everything is picked.
const furthestAllowedStep = (selections: Selections) => {
  const waiting = ownerAgreementPages.findIndex(
    ({choices}) => choices && selections[choices.name].length === 0
  );
  return waiting === -1 ? pageCount : waiting + 1;
};

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user}) => {
    const selections: Selections = {
      equipment: readSelection(input, 'equipment'),
      area: readSelection(input, 'area'),
    };
    const requested = readRequestedStep(input);
    const step = Math.min(requested, furthestAllowedStep(selections));
    return TE.right({
      user,
      step,
      selections,
      sentBack: requested > step,
    });
  };

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};

