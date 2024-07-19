import {MemberDetails} from '../types';
import {html, Html, optionalSafe, sanitizeString} from '../types/html';
import {getGravatarThumbnail} from './avatar';
import {filterList} from './filter-list';

export const memberInputSelector = (member: MemberDetails): Html => html`
  <div class="fieldset-item">
    <input
      type="radio"
      id="member-${member.memberNumber}"
      name="memberNumber"
      value="${member.memberNumber}"
    />
    <label for="member-${member.memberNumber}">
      ${getGravatarThumbnail(member.emailAddress, member.memberNumber)}
      <span>
        ${optionalSafe(member.name)} (${optionalSafe(member.pronouns)})
        (${sanitizeString(member.emailAddress)})
      </span>
    </label>
  </div>
`;

export const memberInput = (
  members: ReadonlyArray<MemberDetails>
): Html => html`
  <fieldset>
    <legend>Select a member:</legend>
    ${filterList(members, 'Members', memberInputSelector)}
  </fieldset>
`;
