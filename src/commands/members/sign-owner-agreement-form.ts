import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {html, joinHtml, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {User} from '../../types';
import {ownerAgreementPages} from './owner-agreement';

// The agreement is long, so it is read a page at a time (?step=1, ?step=2,
// ...) to slow people down, with the sign button only on the last page.
type ViewModel = {user: User; step: number};

const pageCount = ownerAgreementPages.length;

const stepLink = (step: number) => safe(`?step=${step}`);

const renderProgress = (current: number) => html`
  <nav class="agreement-progress" aria-label="Agreement progress">
    <p class="agreement-progress__count">Page ${current} of ${pageCount}</p>
    <ol class="agreement-progress__steps">
      ${joinHtml(
        ownerAgreementPages.map(({label}, index) => {
          const step = index + 1;
          if (step < current) {
            return html`
              <li class="agreement-progress__step agreement-progress__step--done">
                <a href="${stepLink(step)}">
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

const renderBack = (step: number) =>
  step > 1 ? html`<a href="${stepLink(step - 1)}">Back</a>` : html``;

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
  <div class="agreement-nav">${renderBack(viewModel.step)}</div>
`;

const renderNext = (step: number) => html`
  <div class="agreement-nav">
    ${renderBack(step)}
    <a class="button" href="${stepLink(step + 1)}"
      >Next: ${safe(ownerAgreementPages[step].label)}</a
    >
  </div>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack prose">
        <h1>The Owners’ Agreement</h1>
        ${renderProgress(viewModel.step)}
        ${ownerAgreementPages[viewModel.step - 1].body}
        ${viewModel.step === pageCount
          ? renderSign(viewModel)
          : renderNext(viewModel.step)}
      </div>
    `,
    toLoggedInContent(safe('Sign Owner Agreement'))
  );

// Anything missing or out of range starts from the first page.
const parseStep = (input: unknown) =>
  pipe(
    input,
    t.partial({step: tt.IntFromString}).decode,
    E.map(({step}) => step),
    E.chainW(E.fromNullable(null)),
    E.filterOrElseW(
      step => step >= 1 && step <= pageCount,
      () => null
    ),
    E.getOrElse(() => 1)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user}) =>
    TE.right({user, step: parseStep(input)});

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
