import {Member} from '../read-models/shared-state/return-types';
import {html, Html} from '../types/html';

export const memberNumberInputMinimal = (
  field: string,
  label: string,
  members: Pick<Member, 'memberNumber' | 'name' | 'emailAddress'>[]
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
