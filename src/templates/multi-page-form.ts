import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {
  html,
  Html,
  joinHtml,
  safe,
  SanitizedString,
  sanitizeString,
} from '../types/html';

// Shared pieces for a form filled in a page at a time (?step=1, ?step=2, ...),
// as the Owners' Agreement and the purchase request form are.
//
// Each page but the last moves on with a GET form carrying the answers so far
// as hidden inputs, so it all works without JavaScript and Back is just a
// link. The form's own constructForm decides which step to show: it should
// never show a step beyond the first one still missing an answer, so editing
// ?step= in the URL can't skip ahead.

// Answers carried from page to page, as name/value pairs in page order. A
// name may repeat (e.g. several checkboxes ticked).
export type StepValues = ReadonlyArray<readonly [string, string]>;

// A link to one of the form's pages, carrying the answers so far.
export const stepHref = (step: number, values: StepValues) => {
  const query = new URLSearchParams({step: String(step)});
  values.forEach(([name, value]) => query.append(name, value));
  return sanitizeString(`?${query.toString()}`);
};

export const hiddenInputs = (values: StepValues) =>
  joinHtml(
    values.map(
      ([name, value]) =>
        html`<input
          type="hidden"
          name="${sanitizeString(name)}"
          value="${sanitizeString(value)}"
        />`
    )
  );

// Anything missing or out of range starts from the first page.
export const readRequestedStep = (input: unknown, pageCount: number) =>
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

// Numbered markers for each page, ticked (and linked back to) once done, with
// the current page in green.
export const renderStepProgress = ({
  labels,
  current,
  values,
  name,
  doneSuffix = 'done',
}: {
  labels: ReadonlyArray<string>;
  current: number;
  // Carried on the links back to earlier pages
  values: StepValues;
  // Names the progress for screen readers, e.g. "Agreement progress"
  name: string;
  // Read out after a finished page's label, e.g. "(read)"
  doneSuffix?: string;
}) => html`
  <nav class="step-progress" aria-label="${sanitizeString(name)}">
    <p class="step-progress__count">Page ${current} of ${labels.length}</p>
    <ol class="step-progress__steps">
      ${joinHtml(
        labels.map((label, index) => {
          const step = index + 1;
          if (step < current) {
            return html`
              <li class="step-progress__step step-progress__step--done">
                <a href="${stepHref(step, values)}">
                  <span class="step-progress__marker" aria-hidden="true"
                    >✓</span
                  >
                  <span class="step-progress__label"
                    >${sanitizeString(label)}<span class="visually-hidden">
                      (${sanitizeString(doneSuffix)})</span
                    ></span
                  >
                </a>
              </li>
            `;
          }
          return html`
            <li
              class="step-progress__step step-progress__step--${safe(
                step === current ? 'current' : 'todo'
              )}"
              ${step === current ? safe('aria-current="step"') : ''}
            >
              <span class="step-progress__marker" aria-hidden="true"
                >${step}</span
              >
              <span class="step-progress__label"
                >${sanitizeString(label)}</span
              >
            </li>
          `;
        })
      )}
    </ol>
  </nav>
`;

// Back on the left (a link, so it never resubmits anything) and whatever moves
// the reader on - a Next or a final submit button - on the right.
export const renderStepNav = ({
  back,
  next = html``,
}: {
  back: O.Option<SanitizedString>;
  next?: Html;
}) => html`
  <div class="step-nav">
    ${pipe(
      back,
      O.match(
        () => html``,
        href => html`<a href="${href}">Back</a>`
      )
    )}
    ${next}
  </div>
`;

// Back to the previous page, if there is one.
export const backHref = (step: number, values: StepValues) =>
  step > 1 ? O.some(stepHref(step - 1, values)) : O.none;
