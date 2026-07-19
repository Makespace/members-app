import * as O from 'fp-ts/Option';
import {EmailAddress} from '../types';
import {html, sanitizeString} from '../types/html';
import {renderMemberNumber} from './member-number';
import {renderCopyableEmail} from './copyable-email';

type MemberSummary = {
  name: O.Option<string>;
  memberNumber: number;
  primaryEmailAddress: EmailAddress;
};

// A member's name, linked member number and click-to-copy email consolidated
// into a single cell, for tables that show one "Member" column (currently the
// /areas owners tables; intended to be reused as more columns are added).
export const renderMember = (member: MemberSummary, include_private: boolean) => html`
  <div>
    ${sanitizeString(O.getOrElse(() => '-')(member.name))}
    (${renderMemberNumber(member.memberNumber)})
  </div>
  ${include_private ? renderCopyableEmail(member.primaryEmailAddress) : html``}
`;
