import * as O from 'fp-ts/Option';
import {html, Html, joinHtml, safe} from '../../types/html';
import {
  ownerAgreementStatus,
  SignedOwnerAgreement,
} from '../../owner-agreement/agreement';
import {
  AgreementChanges,
  AgreementPage,
  agreementVersions,
  AgreementVersion,
  currentAgreement,
} from '../../owner-agreement/versions';
import {displayDateOnly} from '../../templates/display-date';
import {renderOwnerAgreementStatus} from '../shared-render/owner-agreement';

type ViewModel = {
  version: AgreementVersion;
  signed: O.Option<SignedOwnerAgreement>;
  now: Date;
};

const versionLink = (version: AgreementVersion) =>
  safe(`/owner-agreement?version=${encodeURIComponent(version.key)}`);

// The responsibilities as plain cards, with the ones they said they're
// interested in marked, if this is the version they signed.
const renderChoices = (
  page: AgreementPage,
  picked: ReadonlyArray<string>
) =>
  page.choices
    ? html`<ul class="card-grid">
        ${joinHtml(
          page.choices.responsibilities.map(
            responsibility => html`
              <li
                class="${picked.includes(responsibility.value)
                  ? safe('card-grid__picked')
                  : safe('')}"
              >
                <strong class="card-title"
                  ><i
                    class="fa-regular ${safe(responsibility.icon)}"
                    aria-hidden="true"
                  ></i>
                  ${safe(responsibility.title)}</strong
                >
                ${responsibility.description}
                ${picked.includes(responsibility.value)
                  ? html`<p class="card-grid__picked-note">
                      ✓ You said you're interested in this
                    </p>`
                  : html``}
              </li>
            `
          )
        )}
      </ul>`
    : html``;

const renderAbout = ({version, signed, now}: ViewModel) => {
  const signedThis =
    O.isSome(signed) && signed.value.version === version.key;
  if (signedThis) {
    return html`<div class="callout callout--green">
      <p>
        You signed this version on ${displayDateOnly(signed.value.signedAt)}.
      </p>
      ${renderOwnerAgreementStatus(
        ownerAgreementStatus(signed, now),
        false,
        false
      )}
    </div>`;
  }
  if (version.key === currentAgreement.key) {
    return html`<div class="callout">
      <p>This is the current version of the agreement.</p>
      <p>
        <a href="/members/sign-owner-agreement">Read and sign it</a>
      </p>
    </div>`;
  }
  return html`<div class="callout">
    <p>
      This is an earlier version of the agreement.
      <a href="${versionLink(currentAgreement)}">Read the current version</a>
    </p>
  </div>`;
};

const renderSnippet = (label: string, snippet: Html | undefined) =>
  snippet === undefined
    ? html``
    : html`<div class="agreement-change__snippet">
        <span class="agreement-change__label">${safe(label)}</span>
        <blockquote>${snippet}</blockquote>
      </div>`;

// The wording before and after, folded away until asked for.
const renderWording = (change: AgreementChanges['groups'][number]['changes'][number]) =>
  change.before === undefined && change.after === undefined
    ? html``
    : html`<details class="agreement-change__wording">
        <summary>See the wording</summary>
        <div class="stack">
          ${renderSnippet('Before', change.before)}
          ${renderSnippet('Now', change.after)}
        </div>
      </details>`;

// What changed from what came before: a bullet per change, each with the
// wording before and after to open if wanted (struck-through wording is
// gone, highlighted wording is new).
const renderChanges = (changes: AgreementChanges) => html`
  <section id="changes" class="stack">
    <h2>What changed</h2>
    <p>Changes since ${safe(changes.comparedWith)}.</p>
    ${joinHtml(
      changes.groups.map(
        group => html`
          <h3>${safe(group.heading)}</h3>
          <ul class="agreement-changes">
            ${joinHtml(
              group.changes.map(
                change => html`<li>
                  ${change.summary} ${renderWording(change)}
                </li>`
              )
            )}
          </ul>
        `
      )
    )}
  </section>
`;

const renderVersions = ({version, signed}: ViewModel) => html`
  <h2>All versions</h2>
  <ul>
    ${joinHtml(
      [...agreementVersions].reverse().map(
        candidate => html`<li>
          ${candidate.key === version.key
            ? html`<strong>${safe(candidate.title)}</strong>`
            : html`<a href="${versionLink(candidate)}"
                >${safe(candidate.title)}</a
              >`}
          ${candidate.key === currentAgreement.key
            ? html` (current)`
            : html``}
          ${O.isSome(signed) && signed.value.version === candidate.key
            ? html` - the version you signed`
            : html``}
        </li>`
      )
    )}
  </ul>
`;

export const render = (viewModel: ViewModel) => {
  const signedThis =
    O.isSome(viewModel.signed) &&
    viewModel.signed.value.version === viewModel.version.key;
  const picked = (name: 'equipment' | 'area') =>
    signedThis && O.isSome(viewModel.signed)
      ? viewModel.signed.value.interestedIn[name]
      : [];
  return html`
    <div class="stack prose">
      <h1>${safe(viewModel.version.title)}</h1>
      ${renderAbout(viewModel)}
      ${O.isSome(viewModel.version.changes)
        ? html`<p><a href="#changes">See what changed</a></p>`
        : html``}
      ${joinHtml(
        viewModel.version.pages.map(
          page => html`
            <section class="stack">
              ${page.body}
              ${renderChoices(
                page,
                page.choices ? picked(page.choices.name) : []
              )}
            </section>
          `
        )
      )}
      ${O.isSome(viewModel.version.changes)
        ? renderChanges(viewModel.version.changes.value)
        : html``}
      ${renderVersions(viewModel)}
    </div>
  `;
};
