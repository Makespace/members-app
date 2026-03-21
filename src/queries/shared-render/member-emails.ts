import * as O from 'fp-ts/Option';
import {MemberEmail} from '../../read-models/shared-state/return-types';
import {Html, html, joinHtml, sanitizeString} from '../../types/html';

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

type RenderMemberEmailsArgs = {
  addEmailAction: O.Option<Html>;
  emails: ReadonlyArray<MemberEmail>;
  primaryEmailAddress: string;
  renderAction: (email: MemberEmail) => Html;
};

export const renderMemberEmails = ({
  addEmailAction,
  emails,
  primaryEmailAddress,
  renderAction,
}: RenderMemberEmailsArgs): Html => {
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
      <td>${renderAction(email)}</td>
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
      ${O.isSome(addEmailAction)
        ? html`<tr>
            <td colspan="3">${addEmailAction.value}</td>
          </tr>`
        : html``}
    </table>
  `;
};
