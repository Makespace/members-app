import * as O from 'fp-ts/Option';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {ViewModel, CandidateRow} from './view-model';
import {renderMember} from '../../templates/member';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';

const renderCandidateMember = (row: CandidateRow) => {
  // Resolved to a known member -> full member cell (name, linked number, email).
  // This page is super-user only, so private details (email) are shown.
  if (O.isSome(row.member)) {
    return renderMember(row.member.value, true);
  }
  // Otherwise show whatever the sheet row gave us.
  if (O.isSome(row.memberNumber)) {
    return renderMemberNumber(row.memberNumber.value);
  }
  if (O.isSome(row.email)) {
    return sanitizeString(row.email.value);
  }
  return safe('—');
};

const renderScore = (row: CandidateRow) => {
  const text = `${row.score} / ${row.maxScore}`;
  return row.maxScore > 0 && row.score === row.maxScore
    ? html`<span class="score-full">${safe(text)}</span>`
    : safe(text);
};

// The 'view raw' button sits in the row's rightmost cell and toggles the
// full-width raw row directly below it (see rawToggleScript).
const renderRow = (row: CandidateRow) => html`
  <tr>
    <td>${sanitizeString(row.equipmentName)}</td>
    <td>${renderCandidateMember(row)}</td>
    <td>${displayDate(DateTime.fromJSDate(row.completedAt))}</td>
    <td>${renderScore(row)}</td>
    <td>
      <code
        >${safe(row.rowHash.slice(0, 12))}${row.rowHash.length > 12
          ? safe('…')
          : safe('')}</code
      >
    </td>
    <td style="text-align: right">
      <button type="button" class="view-raw jsonly" aria-expanded="false">
        view raw
      </button>
    </td>
  </tr>
  <tr class="raw-row" hidden>
    <td colspan="6"><pre><code>${sanitizeString(row.raw)}</code></pre></td>
  </tr>
`;

const rawToggleScript = html`
  <script>
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('.view-raw');
      if (!button) return;
      var row = button.closest('tr');
      var rawRow = row && row.nextElementSibling;
      if (!rawRow || !rawRow.classList.contains('raw-row')) return;
      var hidden = rawRow.hasAttribute('hidden');
      if (hidden) {
        rawRow.removeAttribute('hidden');
      } else {
        rawRow.setAttribute('hidden', '');
      }
      button.setAttribute('aria-expanded', hidden ? 'true' : 'false');
    });
  </script>
`;

export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>Training event log</h1>
    <p>
      These are the ${safe(viewModel.candidates.length.toString())} training-quiz
      events that <strong>would</strong> be created from the cached quiz data if
      the one-time migration were run.${viewModel.importedCount > 0
        ? safe(
            ` ${viewModel.importedCount} already-imported rows are hidden.`
          )
        : safe('')}
    </p>
    ${viewModel.candidates.length === 0
      ? html`<p>No cached quiz rows found.</p>`
      : html`
          <table>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Member</th>
                <th>Completed</th>
                <th>Score</th>
                <th>Row hash</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${joinHtml(viewModel.candidates.map(renderRow))}
            </tbody>
          </table>
        `}
    ${rawToggleScript}
  </div>
`;
