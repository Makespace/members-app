import {Member} from '../read-models/shared-state/return-types';
import {html, Html, Safe} from '../types/html';

export const memberNumberInputMinimal = (
  field: Safe,
  label: Safe,
  members: ReadonlyArray<Pick<Member, 'memberNumber' | 'name' | 'emailAddress'>>
): Html => {
  return html`
    <label for="${field}">${label}</label>
    <div style="width:300px;">
      <input type="text" name="${field}" id="${field}" />
    </div>
  `;
};
