import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Form} from '../../types/form';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {formatPence} from '../../types/money';
import {PurchasingAllowance} from '../../read-models/shared-state/return-types';
import {budgetYearOf} from '../../purchasing/budget-year';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

type ViewModel = {
  budgetYear: number;
  allowances: ReadonlyArray<PurchasingAllowance>;
};

const money = (pence: number) => sanitizeString(formatPence(pence));

const renderAllowances = (allowances: ReadonlyArray<PurchasingAllowance>) =>
  allowances.length === 0
    ? html`<p>
        None has been set yet, so each purchasing area's usual budget is the
        one set for it by hand.
      </p>`
    : html`<ul>
        ${joinHtml(
          allowances.map(
            ({fromBudgetYear, allowancePerAreaPence}) =>
              html`<li>
                From ${fromBudgetYear}:
                ${money(allowancePerAreaPence)} per Area
              </li>`
          )
        )}
      </ul>`;

// The allowance this year has, in pounds, to start from; empty when none
// has been set.
const currentAllowance = (
  budgetYear: number,
  allowances: ReadonlyArray<PurchasingAllowance>
) => {
  const current = allowances
    .filter(allowance => allowance.fromBudgetYear <= budgetYear)
    .at(-1);
  return current === undefined
    ? ''
    : (current.allowancePerAreaPence / 100).toFixed(2);
};

const renderForm = ({budgetYear, allowances}: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Set the yearly allowance per Area</h1>
        <p>
          Every Area is allocated the same yearly allowance, and a purchasing
          area's usual budget is its Areas' allowances added together. It
          applies from the year given until another is set. An extension for
          one purchasing area is set as that year's budget on its own page.
        </p>
        ${renderAllowances(allowances)}
        <form
          action="/purchasing-areas/set-allowance?next=%2Fpurchasing-areas"
          method="post"
        >
          <label for="fromBudgetYear">From the year</label>
          <input
            type="text"
            inputmode="numeric"
            name="fromBudgetYear"
            id="fromBudgetYear"
            value="${budgetYear}"
            pattern="[0-9]{4}"
            required
          />
          <label for="allowancePerArea">Allowance per Area (£)</label>
          <input
            type="text"
            inputmode="decimal"
            name="allowancePerArea"
            id="allowancePerArea"
            value="${safe(currentAllowance(budgetYear, allowances))}"
            required
          />
          <button type="submit">Set allowance</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Set yearly allowance'), {
      href: '/purchasing-areas',
      label: 'Purchasing areas',
    })
  );

export const setAllowanceForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    () =>
    ({readModel}) =>
      TE.right({
        budgetYear: budgetYearOf(new Date()),
        allowances: readModel.purchasing.allowances(),
      }),
  formIsAuthorized: isAdminOrSuperUser,
};
