import {html, Html} from '../types/html';

export const memberNumberInputMinimal = (field: string): Html => {
  return html`
    <label for="trainedByMemberNumber">Who did the training?</label>
    <input
      type="text"
      name="trainedByMemberNumber"
      id="trainedByMemberNumber"
    />
  `;
};
