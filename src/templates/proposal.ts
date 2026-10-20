import {html, joinHtml, sanitizeString} from '../types/html';
import {formatPence} from '../types/money';
import {Proposal, ProposalOption, ProposalRisk} from '../purchasing/proposal';

// A purchase request's proposal, as sent: shown on the request's own page.
// Sections that didn't apply (no risk assessment, or nothing said about
// where it goes, who owns it or training and servicing) are left out.

const paragraphs = (text: string) => html`<p class="proposal__text">
  ${sanitizeString(text)}
</p>`;

const renderOption = (option: ProposalOption, index: number) => html`
  <li class="proposal__option">
    <div class="proposal__option-head">
      <strong>Option ${index + 1}: ${sanitizeString(option.description)}</strong>
      <span class="proposal__cost"
        >${sanitizeString(formatPence(option.costPence))}</span
      >
    </div>
    ${option.pros
      ? html`<p class="proposal__text"><strong>Pros:</strong> ${sanitizeString(option.pros)}</p>`
      : html``}
    ${option.cons
      ? html`<p class="proposal__text"><strong>Cons:</strong> ${sanitizeString(option.cons)}</p>`
      : html``}
  </li>
`;

const renderRisk = (risk: ProposalRisk) => html`
  <tr>
    <td class="proposal__text">${sanitizeString(risk.hazard)}</td>
    <td class="proposal__text">${sanitizeString(risk.harm)}</td>
    <td class="proposal__text">${sanitizeString(risk.actions)}</td>
  </tr>
`;

const section = (heading: string, body: ReturnType<typeof html>) => html`
  <section class="proposal__section">
    <h3>${sanitizeString(heading)}</h3>
    ${body}
  </section>
`;

export const renderProposal = (proposal: Proposal) => html`
  <div class="proposal">
    <h2>Proposal</h2>
    ${section('The need', paragraphs(proposal.need))}
    ${section(
      'Options',
      html`<ol class="proposal__options">
        ${joinHtml(proposal.options.map(renderOption))}
      </ol>`
    )}
    ${section('Preferred option', paragraphs(proposal.preferred))}
    ${proposal.risks.length > 0
      ? section(
          'Risk assessment',
          html`<div class="purchase-breakdown__scroll">
            <table class="proposal__risks">
              <thead>
                <tr>
                  <th>Hazard</th>
                  <th>Who could be harmed, and how</th>
                  <th>Remedial actions</th>
                </tr>
              </thead>
              <tbody>
                ${joinHtml(proposal.risks.map(renderRisk))}
              </tbody>
            </table>
          </div>`
        )
      : html``}
    ${proposal.location !== null
      ? section('Where it goes', paragraphs(proposal.location))
      : html``}
    ${proposal.owner !== null
      ? section('Who owns it', paragraphs(proposal.owner))
      : html``}
    ${proposal.trainingAndServicing !== null
      ? section('Training and servicing', paragraphs(proposal.trainingAndServicing))
      : html``}
  </div>
`;
