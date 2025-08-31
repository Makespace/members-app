import * as O from 'fp-ts/Option';

import {html, Html, HtmlSubstitution, safe, Safe} from '../types/html';
import {DateTime} from 'luxon';

const dateToString = (d: DateTime): Safe =>
  safe(d.toFormat('YYYY-MM-DDTHH:mm'));

export const dateTimeInput = (
  field: Safe,
  label: HtmlSubstitution,
  defaultDate: DateTime,
  minimumDate: O.Option<{
    value: DateTime;
    tooltip: string;
  }>,
  maximumDate: O.Option<{
    value: DateTime;
    tooltip: string;
  }>
): Html => {
  return html`
    <input
      type="hidden"
      id="${field}-timezone"
      name="${field}-timezone"
      value=""
    />
    <label for="${field}">${label}</label>
    <input
      type="datetime-local"
      name="${field}"
      id="${field}"
      value="${dateToString(defaultDate)}"
      ${O.isSome(maximumDate)
        ? html`max="${dateToString(maximumDate.value.value)}"`
        : html``}
      ${O.isSome(minimumDate)
        ? html`min="${dateToString(minimumDate.value.value)}"`
        : html``}
    />
  `;
};
