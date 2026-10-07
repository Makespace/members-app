import * as O from 'fp-ts/Option';
import {Html, Safe, html, joinHtml, safe, sanitizeOption, sanitizeString} from '../types/html';
import {renderMemberNumber} from '../templates/member-number';
import {MatchResult, MatchedRow, Outcome, Removal} from './match-fobs';
import {UPLOAD_PATH} from './render-upload-form';
import {MemberCoreInfo} from '../read-models/shared-state/return-types';

// The confirm form is flat, one field group per fob id, so a row needs no
// nesting to survive the round trip: member-<fob>, level-<fob>, name-<fob>
// for a fob to record, remove-<fob> (+ remove-member-<fob>) for one to drop.
export const fieldNames = {
  member: (fobId: number): Safe => safe(`member-${fobId}`),
  level: (fobId: number): Safe => safe(`level-${fobId}`),
  name: (fobId: number): Safe => safe(`name-${fobId}`),
  remove: (fobId: number): Safe => safe(`remove-${fobId}`),
  removeMember: (fobId: number): Safe => safe(`remove-member-${fobId}`),
};

type Matched = Extract<Outcome, {kind: 'matched'}>;

const memberCell = (member: MemberCoreInfo) =>
  html`${renderMemberNumber(member.memberNumber)} ${sanitizeOption(member.name)}`;

const hiddenRowFields = (row: MatchedRow['row']) => html`
  <input type="hidden" name="${fieldNames.level(row.fobId)}" value="${sanitizeString(row.accessLevel)}" />
  <input type="hidden" name="${fieldNames.name(row.fobId)}" value="${sanitizeString(row.paxtonName)}" />
`;

const changeNote = (outcome: Matched): Html => {
  const notes: Html[] = [];
  if (outcome.how === 'name') {
    notes.push(html`matched by name`);
  }
  if (O.isSome(outcome.nameAgrees) && !outcome.nameAgrees.value) {
    notes.push(html`<strong>⚠ name does not look like the app's</strong>`);
  }
  if (outcome.change === 'moved' && O.isSome(outcome.previousHolder)) {
    notes.push(
      html`moved from ${renderMemberNumber(outcome.previousHolder.value.memberNumber)}`
    );
  } else if (outcome.change === 'updated') {
    notes.push(html`access level or name changed`);
  }
  return joinHtml(notes.map(note => html`<span>${note}</span> `));
};

const renderToRecord = (rows: ReadonlyArray<MatchedRow & {outcome: Matched}>) =>
  rows.length === 0
    ? html``
    : html`
        <h2>To record (${rows.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Name in Paxton</th>
              <th>Fob</th>
              <th>Access level</th>
              <th>Member</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(
              rows.map(
                ({row, outcome}) => html`
                  <tr>
                    <td>${sanitizeString(row.paxtonName)}</td>
                    <td>${row.fobId}</td>
                    <td>${sanitizeString(row.accessLevel)}</td>
                    <td>
                      ${memberCell(outcome.member)}
                      <input type="hidden" name="${fieldNames.member(row.fobId)}" value="${outcome.member.memberNumber}" />
                      ${hiddenRowFields(row)}
                    </td>
                    <td>${changeNote(outcome)}</td>
                  </tr>
                `
              )
            )}
          </tbody>
        </table>
      `;

type Unresolved = Extract<Outcome, {kind: 'unmatched' | 'ambiguous' | 'unknown-number'}>;

const unresolvedNote = (outcome: Unresolved): Html => {
  switch (outcome.kind) {
    case 'unknown-number':
      return html`No member ${outcome.memberNumber} in the app`;
    case 'unmatched':
      return html`No member with this name`;
    case 'ambiguous':
      return html`Could be: ${joinHtml(
        outcome.candidates.map(candidate => html`${memberCell(candidate)} `)
      )}`;
  }
};

const renderUnresolved = (
  rows: ReadonlyArray<MatchedRow & {outcome: Unresolved}>
) =>
  rows.length === 0
    ? html``
    : html`
        <h2>Needs a member number (${rows.length})</h2>
        <p>
          Type the member number to record the fob against them, or leave it
          blank to skip the row for now. Skipped rows come back on the next
          upload, so fixing the name in Paxton is the lasting fix.
        </p>
        <table>
          <thead>
            <tr>
              <th>Name in Paxton</th>
              <th>Fob</th>
              <th>Access level</th>
              <th>Member number</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(
              rows.map(
                ({row, outcome}) => html`
                  <tr>
                    <td>${sanitizeString(row.paxtonName)}</td>
                    <td>${row.fobId}</td>
                    <td>${sanitizeString(row.accessLevel)}</td>
                    <td>
                      <input type="text" inputmode="numeric" pattern="[0-9]*" size="6" name="${fieldNames.member(row.fobId)}" />
                      ${hiddenRowFields(row)}
                    </td>
                    <td>${unresolvedNote(outcome)}</td>
                  </tr>
                `
              )
            )}
          </tbody>
        </table>
      `;

const renderRemovals = (removals: ReadonlyArray<Removal>) =>
  removals.length === 0
    ? html``
    : html`
        <h2>No longer in the export (${removals.length})</h2>
        <p>
          The app has these fobs but the export does not. Ticked ones are
          removed from the member's record when you confirm.
        </p>
        <table>
          <thead>
            <tr>
              <th>Remove</th>
              <th>Fob</th>
              <th>Member</th>
              <th>Was</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(
              removals.map(
                ({member, fob}) => html`
                  <tr>
                    <td>
                      <input type="checkbox" name="${fieldNames.remove(fob.fobId)}" checked />
                      <input type="hidden" name="${fieldNames.removeMember(fob.fobId)}" value="${member.memberNumber}" />
                    </td>
                    <td>${fob.fobId}</td>
                    <td>${memberCell(member)}</td>
                    <td>${sanitizeString(fob.accessLevel)} — ${sanitizeString(fob.paxtonName)}</td>
                  </tr>
                `
              )
            )}
          </tbody>
        </table>
      `;

const renderSkipped = (
  heading: string,
  explanation: string,
  rows: ReadonlyArray<MatchedRow>
) =>
  rows.length === 0
    ? html``
    : html`
        <details>
          <summary>${sanitizeString(heading)} (${rows.length})</summary>
          <p>${sanitizeString(explanation)}</p>
          <ul>
            ${joinHtml(
              rows.map(
                ({row}) => html`<li>${sanitizeString(row.paxtonName)} — fob ${row.fobId}, ${sanitizeString(row.accessLevel)}</li>`
              )
            )}
          </ul>
        </details>
      `;

const isMatched = (r: MatchedRow): r is MatchedRow & {outcome: Matched} =>
  r.outcome.kind === 'matched';
const isUnresolved = (r: MatchedRow): r is MatchedRow & {outcome: Unresolved} =>
  r.outcome.kind === 'unmatched' ||
  r.outcome.kind === 'ambiguous' ||
  r.outcome.kind === 'unknown-number';

export const renderPreview = (result: MatchResult) => {
  const toRecord = result.rows
    .filter(isMatched)
    .filter(r => r.outcome.change !== 'unchanged');
  const unchanged = result.rows
    .filter(isMatched)
    .filter(r => r.outcome.change === 'unchanged');
  const unresolved = result.rows.filter(isUnresolved);
  const notMembers = result.rows.filter(r => r.outcome.kind === 'not-a-member');
  const duplicates = result.rows.filter(r => r.outcome.kind === 'duplicate-fob');
  const nothingToDo = toRecord.length === 0 && result.removals.length === 0 && unresolved.length === 0;

  return html`
    <h1>Import fobs from Paxton: preview</h1>
    <p>
      ${result.rows.length} rows in the export: ${toRecord.length} to record,
      ${unchanged.length} already up to date, ${unresolved.length} needing a
      member number, ${notMembers.length} not members;
      ${result.removals.length} fobs no longer in the export.
    </p>
    ${nothingToDo
      ? html`<p><strong>Nothing to change.</strong> <a href="${UPLOAD_PATH}">Upload another file</a></p>`
      : html`
          <form action="${UPLOAD_PATH}" method="post" enctype="multipart/form-data" class="stack">
            ${renderToRecord(toRecord)}
            ${renderUnresolved(unresolved)}
            ${renderRemovals(result.removals)}
            <button type="submit">Confirm and record</button>
          </form>
        `}
    ${renderSkipped(
      'Already up to date',
      'These fobs are recorded exactly as the export has them.',
      unchanged
    )}
    ${renderSkipped(
      'Not members',
      'Door, university and varsity tokens; the app does not track these.',
      notMembers
    )}
    ${renderSkipped(
      'Duplicate fob ids',
      'The export lists these fob ids more than once; only the first occurrence is used.',
      duplicates
    )}
  `;
};
