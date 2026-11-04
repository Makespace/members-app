import {pipe} from 'fp-ts/lib/function';
import {
  html,
  joinHtml,
  safe,
  sanitizeOption,
  sanitizeString,
} from '../../types/html';
import * as N from 'fp-ts/number';
import {contramap, Ord} from 'fp-ts/Ord';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {getGravatarThumbnail} from '../../templates/avatar';
import {
  renderMemberNumber,
  renderMemberNumbers,
} from '../../templates/member-number';
import {memberStatusTag} from '../../templates/member-status';
import {otherMemberNumbersTooltip} from '../shared-render/other-member-numbers-tooltip';

type MemberWithRecurlyStatus = ViewModel['members'][number];

const ordByMemberNumber: Ord<MemberWithRecurlyStatus> = pipe(
  N.Ord,
  contramap(member => member.memberNumber)
);

const memberRow = (member: MemberWithRecurlyStatus) => html`
  <tr>
    <td>
      ${getGravatarThumbnail(member.gravatarHash, member.memberNumber)}
    </td>
    <td>${renderMemberNumber(member.memberNumber)}</td>
    <td>${renderMemberNumbers(member.pastMemberNumbers)}</td>
    <td>${sanitizeOption(member.name)}</td>
    <td>${sanitizeOption(member.formOfAddress)}</td>
    <td>${sanitizeString(member.primaryEmailAddress)}</td>
    <td>${memberStatusTag(member.recurlyStatus)}</td>
  </tr>
`;

const renderMemberTable = (members: ReadonlyArray<MemberWithRecurlyStatus>) =>
  html`
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Member number</th>
          <th>Other member numbers ${otherMemberNumbersTooltip}</th>
          <th>Full Name</th>
          <th>Preferred form of address</th>
          <th>Email</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${joinHtml(pipe(members, RA.sort(ordByMemberNumber), RA.map(memberRow)))}
      </tbody>
    </table>
  `;

const renderMembers = (viewModel: ViewModel) => {
  if (viewModel.members.length === 0) {
    return html` <p>Currently no members</p> `;
  }

  // The split is driven by the shared Recurly status, which treats "no fresh
  // data" (e.g. unverified email, stale/missing cache) as inactive — so the
  // active table is not a complete list of everyone with a current membership.
  const activeMembers = viewModel.members.filter(
    member => member.recurlyStatus === 'active'
  );
  const inactiveMembers = viewModel.members.filter(
    member => member.recurlyStatus !== 'active'
  );

  return html`
    <h2>Active members (${safe(activeMembers.length.toString())})</h2>
    ${activeMembers.length === 0
      ? html` <p>No active members — see inactive members below.</p> `
      : renderMemberTable(activeMembers)}
    ${inactiveMembers.length === 0
      ? html``
      : html`
          <details>
            <summary>Inactive members (${safe(inactiveMembers.length.toString())})</summary>
            ${renderMemberTable(inactiveMembers)}
          </details>
        `}
  `;
};

export const render = (viewModel: ViewModel) => html`
  <h1>Members of Makespace</h1>
  ${renderMembers(viewModel)}
`;
