import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../read-models/members/avatar';
import {html, Html, Safe, sanitizeString} from '../types/html';
import {EmailAddress, GravatarHash, isoGravatarHash} from '../types';

type SelectableMember = {
  memberNumber: number;
  emailAddress: EmailAddress;
  name: O.Option<string>;
  gravatarHash?: GravatarHash;
};

const getGravatarHashString = (member: SelectableMember): string => {
  if (member.gravatarHash) {
    return isoGravatarHash.unwrap(member.gravatarHash);
  }
  return isoGravatarHash.unwrap(gravatarHashFromEmail(member.emailAddress));
};

export const memberSelector = (
  fieldName: Safe,
  label: Safe,
  members: ReadonlyArray<SelectableMember>
): Html => {
  const membersJson = JSON.stringify(
    members.map(m => ({
      memberNumber: m.memberNumber,
      email: m.emailAddress,
      name: O.isSome(m.name) ? m.name.value : null,
      gravatarHash: getGravatarHashString(m),
    }))
  );

  return html`
    <div class="member-selector" data-member-selector>
      <label for="${fieldName}-search">${label}</label>
      <div class="member-selector__container">
        <input
          type="text"
          id="${fieldName}-search"
          class="member-selector__search"
          placeholder="Search by name, email, or member number..."
          autocomplete="off"
          data-search-input
        />
        <input type="hidden" name="${fieldName}" data-member-value />
        <div class="member-selector__dropdown" data-dropdown hidden>
          <ul class="member-selector__list" data-member-list></ul>
        </div>
        <div class="member-selector__selected" data-selected-display hidden>
          <span data-selected-text></span>
          <button type="button" class="member-selector__clear" data-clear-btn>
            &times;
          </button>
        </div>
      </div>
      <script data-members type="application/json">
        ${sanitizeString(membersJson)}
      </script>
    </div>
  `;
};
