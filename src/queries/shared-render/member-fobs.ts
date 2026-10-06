import {MemberFob} from '../../read-models/shared-state/return-types';
import {Html, html, joinHtml, sanitizeString} from '../../types/html';
import {displayDateOnly} from '../../templates/display-date';

const removeFob = (memberNumber: number, fobId: number) => html`
  <a href="/members/remove-fob?member=${memberNumber}&fob=${fobId}">
    Remove
  </a>
`;

const recordFob = (memberNumber: number) => html`
  <a href="/members/record-fob?member=${memberNumber}">Record a fob</a>
`;

// Super-user only: the caller is responsible for not rendering this for
// anyone else (and the read model hands non-super-users an empty list).
export const renderMemberFobs = (
  memberNumber: number,
  fobs: ReadonlyArray<MemberFob>
): Html => {
  const renderFobRow = (fob: MemberFob): Html => html`
    <tr>
      <td>${fob.fobId}</td>
      <td>${sanitizeString(fob.accessLevel)}</td>
      <td>${sanitizeString(fob.paxtonName)}</td>
      <td>${displayDateOnly(fob.recordedAt)}</td>
      <td>${removeFob(memberNumber, fob.fobId)}</td>
    </tr>
  `;

  if (fobs.length === 0) {
    return html`
      <p>No fobs recorded.</p>
      ${recordFob(memberNumber)}
    `;
  }

  return html`
    <table>
      <thead>
        <tr>
          <th>Fob id</th>
          <th>Access level</th>
          <th>Name in Paxton</th>
          <th>Recorded</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${joinHtml(fobs.map(renderFobRow))}
        <tr>
          <td colspan="5">${recordFob(memberNumber)}</td>
        </tr>
      </tbody>
    </table>
  `;
};
