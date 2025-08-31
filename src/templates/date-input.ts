import * as O from 'fp-ts/Option';

import {html, Html} from '../types/html';

export const dateInput = (
  field: string,
  title: string,
  minimumDate: O.Option<{
    value: Date;
    tooltip: string;
  }>,
  maximumDate: O.Option<{
    value: Date;
    tooltip: string;
  }>
): Html => {
  return html`
    <label for="trainedByMemberNumber">Who did the training?</label>
    <input
      type="text"
      name="trainedByMemberNumber"
      id="trainedByMemberNumber"
    />
  `;
};
