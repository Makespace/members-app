import * as O from 'fp-ts/Option';
import {Html, html, joinHtml, sanitizeOption, sanitizeString} from '../../types/html';
import {renderMemberNumber} from '../../templates/member-number';
import {tag} from '../../templates/member-status';
import {AuditRow, Entitlement} from './classify';
import {ViewModel} from './view-model';

const whyTag = (entitlement: Entitlement): Html => {
  if (entitlement.kind === 'entitled') {
    return tag(html`active`, 'green');
  }
  switch (entitlement.why) {
    case 'overdue':
      return tag(
        html`${O.getOrElse(() => 0)(entitlement.daysOverdue)} days overdue`,
        'red'
      );
    case 'expired':
      return tag(html`membership lapsed`, 'grey');
    case 'no-data':
      return tag(html`no Recurly record`, 'red');
    case 'future-only':
      return tag(html`not started yet`, 'grey');
    case 'paused':
      return tag(html`paused in Recurly`, 'grey');
  }
};

const fobsCell = (row: AuditRow): Html =>
  row.member.fobs.length === 0
    ? html`<i>none recorded</i>`
    : joinHtml(
        row.member.fobs.map(
          fob => html`<div>${fob.fobId} <small>${sanitizeString(fob.accessLevel)}</small></div>`
        )
      );

const renderRows = (rows: ReadonlyArray<AuditRow>): Html =>
  joinHtml(
    [...rows]
      .sort((a, b) => a.member.memberNumber - b.member.memberNumber)
      .map(
        row => html`
          <tr>
            <td>${renderMemberNumber(row.member.memberNumber)}</td>
            <td>${sanitizeOption(row.member.name)}</td>
            <td>${whyTag(row.entitlement)}</td>
            <td>${fobsCell(row)}</td>
          </tr>
        `
      )
  );

const renderGroup = (
  heading: Html,
  explanation: Html,
  rows: ReadonlyArray<AuditRow>
): Html => html`
  <h2>${heading} (${rows.length})</h2>
  <p>${explanation}</p>
  ${rows.length === 0
    ? html`<p><i>Nobody.</i></p>`
    : html`
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Name</th>
              <th>Membership</th>
              <th>Fobs</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(rows)}
          </tbody>
        </table>
      `}
`;

export const render = (viewModel: ViewModel): Html => html`
  <h1>Door access audit</h1>
  <p>
    Who the door lets in, from the fobs recorded by the Paxton import,
    against who membership says it should. A member is counted as entitled
    with a live Recurly subscription, unless they are
    ${viewModel.thresholds.removeAccessAfterDays} or more days behind on an
    invoice. ${viewModel.groups.consistent} of ${viewModel.totalMembers}
    members are as they should be.
  </p>
  ${viewModel.membersWithFobs === 0
    ? html`<p>
        <strong>No fobs have been imported yet</strong>, so everyone shows as
        having none. <a href="/members/import-fobs">Import the Paxton export</a>
        first.
      </p>`
    : html``}
  ${renderGroup(
    html`Can get in but should not`,
    html`A live fob, but no entitlement. Cancel the fob in Paxton, or sort out
    the membership. "No Recurly record" can mean an email mismatch rather than
    a lapsed member: check before cancelling.`,
    viewModel.groups.toRevoke
  )}
  ${renderGroup(
    html`Should get in but fob is cancelled`,
    html`An entitled member whose fob is set to cancelled in Paxton; most
    likely a returning member. Reinstate the fob.`,
    viewModel.groups.toReinstate
  )}
  ${renderGroup(
    html`Should get in but no fob recorded`,
    html`An entitled member with no fob known to the app: either they need one,
    or their Paxton row did not match on the last import (fix the name in
    Paxton to include their member number).`,
    viewModel.groups.noFob
  )}
  ${renderGroup(
    html`Paused on purpose`,
    html`Entitled members whose fob is parked or sanctioned in Paxton. Listed
    so nobody re-enables them by mistake.`,
    viewModel.groups.pausedOnPurpose
  )}
`;
