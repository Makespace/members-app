import {Member} from '../read-models/members';
import {html, Html, sanitizeOption, sanitizeString} from '../types/html';
import {getGravatarThumbnail} from './avatar';
import {filterList} from './filter-list';

const memberInputSelector = (member: Member): Html => html`
  <div class="fieldset-item">
    <input
      type="radio"
      id="member-${member.memberNumber}"
      name="memberNumber"
      value="${member.memberNumber}"
    />
    <label for="member-${member.memberNumber}">
      ${getGravatarThumbnail(member.gravatarHash, member.memberNumber)}
      <span>
        ${sanitizeOption(member.name)} (${sanitizeOption(member.pronouns)})
        (${sanitizeString(member.emailAddress)})
      </span>
    </label>
  </div>
`;

export const memberInput = (members: ReadonlyArray<Member>): Html => html`
  <fieldset>
    <legend>Select a member:</legend>
    ${filterList(members, 'Members', memberInputSelector)}
  </fieldset>
`;
