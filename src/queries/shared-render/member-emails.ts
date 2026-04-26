import * as O from 'fp-ts/Option';
import {MemberEmail} from '../../read-models/shared-state/return-types';
import {Html, html, joinHtml, sanitizeString} from '../../types/html';
import { EmailAddress } from '../../types/email-address';
import { SEND_EMAIL_VERIFICATION_COOLDOWN_MS } from '../../configuration';

const sortMemberEmailByVerifiedThenAddedDate = (
  a: MemberEmail,
  b: MemberEmail
): 1 | -1 | 0 => {
  if (O.isSome(a.verifiedAt) && O.isSome(b.verifiedAt)) {
    const aVerifiedTimestamp = a.verifiedAt.value.getTime();
    const bVerifiedTimestamp = b.verifiedAt.value.getTime();
    if (aVerifiedTimestamp > bVerifiedTimestamp) {
      return 1;
    }
    if (aVerifiedTimestamp === bVerifiedTimestamp) {
      return 0;
    }
    return -1;
  }
  if (O.isSome(a.verifiedAt) && O.isNone(b.verifiedAt)) {
    return 1;
  }
  if (O.isSome(b.verifiedAt) && O.isNone(a.verifiedAt)) {
    return -1;
  }
  const aAddedTimestamp = a.addedAt.getTime();
  const bAddedTimestamp = b.addedAt.getTime();
  if (aAddedTimestamp > bAddedTimestamp) {
    return 1;
  }
  if (aAddedTimestamp === bAddedTimestamp) {
    return 0;
  }
  return -1;
};

const sendVerifyEmail = (memberNumber: number, email: MemberEmail) => {
  if (
    O.isSome(email.verificationLastSent) && (
      (Date.now() - email.verificationLastSent.value.getTime()) < SEND_EMAIL_VERIFICATION_COOLDOWN_MS
    )
  ) {
    return html`Verification Email Sent At ${sanitizeString(email.verificationLastSent.value.toLocaleTimeString())}!`
  }
  return html`
    <a
      href="/members/send-email-verification?email=${sanitizeString(email.emailAddress)}&member=${memberNumber}"
    >
      Send Verification Email
    </a>
  `;
}

const setPrimaryEmail = (email: EmailAddress, memberNumber: number) => html`
  <a
    href="/members/change-primary-email?email=${sanitizeString(email)}&member=${memberNumber}"
  >
    Make Primary Email
  </a>
`;

const addEmail = (memberNumber: number) => html`
  <a
    href="/members/add-email?member=${memberNumber}"
  >
    Add New Email
  </a>
`;

export const renderMemberEmails = (
  memberNumber: number,
  emails: ReadonlyArray<MemberEmail>,
  primaryEmailAddress: EmailAddress
): Html => {
  const secondaryEmails = emails
    .filter(email => email.emailAddress !== primaryEmailAddress)
    .toSorted(sortMemberEmailByVerifiedThenAddedDate);

  const renderEmailTableRow = (email: MemberEmail): Html => html`
    <tr>
      <td></td>
      <td>
        ${sanitizeString(email.emailAddress)}
        ${O.isSome(email.verifiedAt) ? html`✅` : html``}
      </td>
      <td>${
        O.isSome(email.verifiedAt)
        ? setPrimaryEmail(email.emailAddress, memberNumber)
        : sendVerifyEmail(memberNumber, email)
      }</td>
    </tr>
  `;

  return html`
    <table>
      <tr>
        <td>Primary</td>
        <td>${sanitizeString(primaryEmailAddress)} ✅</td>
        <td></td>
      </tr>
      ${joinHtml(secondaryEmails.map(renderEmailTableRow))}
      <tr>
        <td colspan="3">${addEmail(memberNumber)}</td>
      </tr>
    </table>
  `;
};
