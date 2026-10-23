import * as O from 'fp-ts/Option';
import mjml2html from 'mjml';
import {Email} from '../types';
import {sanitizeString} from '../types/html';
import {formatPence} from '../types/money';
import {PurchaseRequest} from '../read-models/shared-state/return-types';
import {NotificationReason, Recipient} from './notification-recipients';

// The email sent about a purchase request; who gets it is decided in
// notification-recipients.ts.

export type NotificationKind = 'new' | 'outcome' | 'skipped-proposal';

type EmailContext = {
  publicUrl: string;
  areaName: string;
  requesterName: string;
  // Who approved or declined it, for an outcome.
  deciderName: string;
};

const requestUrl = (publicUrl: string, request: PurchaseRequest) =>
  `${publicUrl}/purchase-requests/view/${request.id}`;

const whyYou = (
  reason: NotificationReason,
  {areaName}: EmailContext
): string => {
  switch (reason) {
    case 'purchaser':
      return `You're a purchaser for ${areaName}.`;
    case 'management-team':
      return "You're on the Management Team.";
    case 'director':
      return "You're a director.";
    case 'requesting-area-owner':
      return `You own an area in ${areaName}.`;
    case 'affected-area-owner':
      return 'You own an area it could negatively impact.';
    case 'super-user':
      return "You're a super user, and nobody else was set up to hear about it.";
    case 'heard-about-it':
      return 'You were told about this request when it was sent.';
    case 'requester':
      return 'You sent this request.';
  }
};

const notificationSubject = (
  kind: NotificationKind,
  request: PurchaseRequest,
  recipient: Recipient
): string => {
  switch (kind) {
    case 'new':
      if (request.approval === 'none') {
        return `Purchase request to approve: ${request.summary}`;
      }
      return recipient.reasons.includes('affected-area-owner')
        ? `Purchase request that could affect your area: ${request.summary}`
        : `Purchase request needing director approval: ${request.summary}`;
    case 'outcome':
      return `Purchase request ${request.status === 'declined' ? 'declined' : 'approved'}: ${request.summary}`;
    case 'skipped-proposal':
      return request.outcome === 'outside-budget'
        ? `Purchase recorded as approved outside the budget: ${request.summary}`
        : `Purchase recorded without a proposal: ${request.summary}`;
  }
};

// The email's paragraphs, as plain text; the HTML version escapes them.
const notificationParagraphs = (
  kind: NotificationKind,
  request: PurchaseRequest,
  recipient: Recipient,
  context: EmailContext
): ReadonlyArray<string> => {
  const what = `"${request.summary}" (${formatPence(request.totalPence)}) for ${context.areaName}`;
  const reasons = recipient.reasons.map(reason => whyYou(reason, context));
  switch (kind) {
    case 'new':
      return [
        `${context.requesterName} has asked to buy ${what}.`,
        `Why it's needed: ${request.justification}`,
        ...(request.approval === 'proposal'
          ? [
              `It needs director approval: ${request.outcomeReason}`,
              ...(request.affectedAreaIds.length > 0
                ? [
                    "A manager will arrange a conversation with the owners of the areas it could affect, or it can be raised at the monthly owners' forum. Once they've agreed, a super user approves or declines it.",
                  ]
                : []),
            ]
          : []),
        ...reasons,
        recipient.canDecide
          ? 'Please approve or decline it.'
          : "There's nothing you need to do.",
      ];
    case 'outcome': {
      const declined = request.status === 'declined';
      const note = declined
        ? request.declineReason
        : request.approvalNote;
      return [
        `${context.deciderName} ${declined ? 'declined' : 'approved'} ${context.requesterName}'s request to buy ${what}.`,
        ...(O.isSome(note)
          ? [`${declined ? 'Why' : 'Note'}: ${note.value}`]
          : []),
        ...reasons,
      ];
    }
    case 'skipped-proposal':
      return [
        request.outcome === 'outside-budget'
          ? `${context.requesterName} bought ${what} directly, as approved by the directors outside the yearly budget.`
          : `${context.requesterName} bought ${what} directly. As a super user, they went ahead without the proposal it would otherwise need: ${request.outcomeReason}`,
        `Why it's needed: ${request.justification}`,
        ...reasons,
        "There's nothing you need to do.",
      ];
  }
};

export const buildNotificationEmail = (
  kind: NotificationKind,
  request: PurchaseRequest,
  recipient: Recipient,
  context: EmailContext
): Email => {
  const paragraphs = notificationParagraphs(kind, request, recipient, context);
  const url = requestUrl(context.publicUrl, request);
  return {
    recipient: recipient.email,
    subject: notificationSubject(kind, request, recipient),
    text: [...paragraphs, `View the request: ${url}`].join('\n\n'),
    html: mjml2html(`
      <mjml>
        <mj-body width="600px">
          <mj-section background-color="#fa990e">
            <mj-column>
              <mj-text align="center" color="#111" font-size="28px">Makespace</mj-text>
            </mj-column>
          </mj-section>
          <mj-section>
            <mj-column>
              <mj-text font-size="16px" color="#111">
                ${paragraphs.map(paragraph => `<p>${sanitizeString(paragraph)}</p>`).join('')}
              </mj-text>
              <mj-button background-color="#00703c" href="${url}">View the request</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
  };
};
