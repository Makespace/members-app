import {html, safe} from '../../types/html';
import {displayDateOnly, displayDateShort} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {OwnerAgreementStatus} from '../../owner-agreement/agreement';

const agreementLink = safe('/members/sign-owner-agreement');

// Where someone stands with the Owners' Agreement, as a sentence for their
// own page (or, third person, for a super user looking at theirs).
export const renderOwnerAgreementStatus = (
  status: OwnerAgreementStatus,
  thirdPerson: boolean,
  // Off when already reading the agreement back
  linkToReread = true
) => {
  const they = thirdPerson ? safe('They') : safe('You');
  const their = thirdPerson ? safe('Their') : safe('Your');
  const reread =
    thirdPerson || !linkToReread || status.state === 'unsigned'
      ? html``
      : html`<p>
          <a href="/owner-agreement">Read the agreement you signed</a>
        </p>`;
  return html`${renderStatus(status, thirdPerson, they, their)}${reread}`;
};

const renderStatus = (
  status: OwnerAgreementStatus,
  thirdPerson: boolean,
  they: ReturnType<typeof safe>,
  their: ReturnType<typeof safe>
) => {
  switch (status.state) {
    case 'unsigned':
      return thirdPerson ? html`<p>Not signed.</p>` : html``;
    case 'outdated':
      return html`<p>
        ${they} signed the original Owners' Agreement
        (${displayDateOnly(status.signedAt)}), but not the new one.
        ${thirdPerson
          ? html``
          : html`<a href="${agreementLink}">Read the new agreement</a>`}
      </p>`;
    case 'signed':
      return html`<p>
        ${they} signed the Owners' Agreement. ${their} term runs until
        ${displayDateOnly(status.termEnds)}.
      </p>`;
    case 'renewal-due':
      return html`<p>
        ${their} Owners' Agreement term ends on
        ${displayDateOnly(status.termEnds)} and is due for renewal.
        ${thirdPerson
          ? html``
          : html`<a href="${agreementLink}">Read and re-sign it</a>`}
      </p>`;
    case 'lapsed':
      return html`<p>
        ${their} Owners' Agreement term ended on
        ${displayDateOnly(status.termEnds)}.
        ${thirdPerson
          ? html``
          : html`<a href="${agreementLink}">Read and re-sign it</a>`}
      </p>`;
  }
};

// The same, squeezed into a table cell.
export const renderOwnerAgreementCell = (status: OwnerAgreementStatus) => {
  const short = (date: Date) => displayDateShort(DateTime.fromJSDate(date));
  switch (status.state) {
    case 'unsigned':
      return html`Not signed`;
    case 'outdated':
      return html`<span title="Signed ${displayDateOnly(status.signedAt)}"
        >Original only</span
      >`;
    case 'signed':
      return html`Until ${short(status.termEnds)}`;
    case 'renewal-due':
      return html`<strong>Renew by ${short(status.termEnds)}</strong>`;
    case 'lapsed':
      return html`<strong>Lapsed ${short(status.termEnds)}</strong>`;
  }
};
