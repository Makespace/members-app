import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import {
  html,
  joinHtml,
  safe,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {User} from '../../types';
import {currentAgreement} from '../../owner-agreement/versions';
import * as O from 'fp-ts/Option';
import {
  OwnerAgreementStatus,
  ownerAgreementStatus,
  renewalOpensAt,
  termEndsFor,
} from '../../owner-agreement/agreement';
import {displayDateOnly} from '../../templates/display-date';
import {
  backHref,
  hiddenInputs,
  readRequestedStep,
  renderStepNav,
  renderStepProgress,
} from '../../templates/multi-page-form';

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
  // Where they stand with the agreement now, which decides what signing does
  agreement: OwnerAgreementStatus;
  now: Date;
};

const ownerAgreementPages = currentAgreement.pages;

const pageCount = ownerAgreementPages.length;

const choiceNames: ReadonlyArray<ChoiceName> = ['equipment', 'area'];

const selectionPairs = (selections: Selections, except?: ChoiceName) =>
  choiceNames
    .filter(name => name !== except)
    .flatMap(name => selections[name].map(value => [name, value] as const));

const renderProgress = (current: number, selections: Selections) =>
  renderStepProgress({
    labels: ownerAgreementPages.map(({label}) => label),
    current,
    values: selectionPairs(selections),
    name: 'Agreement progress',
    doneSuffix: 'read',
  });

const renderBack = ({step, selections}: ViewModel) =>
  backHref(step, selectionPairs(selections));

const renderNav = (viewModel: ViewModel) =>
  renderStepNav({
    back: renderBack(viewModel),
    next: html`<button type="submit">
      Next: ${safe(ownerAgreementPages[viewModel.step].label)}
    </button>`,
  });

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

// What signing now does to their term, said before they sign.
const renderTerm = ({agreement, now}: ViewModel) => {
  const renewing = agreement.state === 'renewal-due';
  return pipe(
    termEndsFor(
      currentAgreement.key,
      now,
      renewing ? O.some(agreement.termEnds) : O.none
    ),
    O.match(
      () => html``,
      newTermEnds =>
        renewing
          ? html`<p>
              Your current term ends on
              ${displayDateOnly(agreement.termEnds)}. Signing now renews it
              until ${displayDateOnly(newTermEnds)}.
            </p>`
          : html`<p>
              You're signing up for six months, until
              ${displayDateOnly(newTermEnds)}. We'll remind you to renew
              before then.
            </p>`
    )
  );
};

const renderAlreadySigned = (
  viewModel: ViewModel,
  termEnds: Date
) => html`
  <div class="callout callout--green">
    <p>
      You've already signed this agreement. Your current term runs until
      ${displayDateOnly(termEnds)}, and you can renew it from
      ${displayDateOnly(renewalOpensAt(termEnds))}.
    </p>
  </div>
  ${renderStepNav({back: renderBack(viewModel)})}
`;

const renderSign = (viewModel: ViewModel) =>
  viewModel.agreement.state === 'signed'
    ? renderAlreadySigned(viewModel, viewModel.agreement.termEnds)
    : html`
  <div class="callout callout--green">
    <p>
      By signing this agreement you're confirming that you understand the
      responsibilities of ownership and want to take an active role in your
      area.
    </p>
    ${renderTerm(viewModel)}
    <form action="?next=/me" method="post">
      ${hiddenInputs(selectionPairs(viewModel.selections))}
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
  ${renderStepNav({back: renderBack(viewModel)})}
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
  ({user, readModel}) => {
    const now = new Date();
    const selections: Selections = {
      equipment: readSelection(input, 'equipment'),
      area: readSelection(input, 'area'),
    };
    const requested = readRequestedStep(input, pageCount);
    const step = Math.min(requested, furthestAllowedStep(selections));
    return TE.right({
      user,
      step,
      selections,
      sentBack: requested > step,
      agreement: ownerAgreementStatus(
        pipe(
          readModel.members.getByMemberNumber(user.memberNumber),
          O.chain(member => member.ownerAgreement)
        ),
        now
      ),
      now,
    });
  };

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};

