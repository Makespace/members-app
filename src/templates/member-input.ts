import {html, Html, sanitizeOption, sanitizeString} from '../types/html';
import {getGravatarThumbnail} from './avatar';
import {filterList} from './filter-list';

type Member = {
  memberNumber: number;
  name: import('fp-ts/Option').Option<string>;
  formOfAddress: import('fp-ts/Option').Option<string>;
  gravatarHash: import('../types').GravatarHash;
} & (
  | {emailAddress: import('../types').EmailAddress}
  | {primaryEmailAddress: import('../types').EmailAddress}
);

const getDisplayEmailAddress = (member: Member) =>
  'primaryEmailAddress' in member
    ? member.primaryEmailAddress
    : member.emailAddress;

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
        ${sanitizeOption(member.name)} (${sanitizeOption(member.formOfAddress)})
        (${sanitizeString(getDisplayEmailAddress(member))})
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
