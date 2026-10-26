import * as O from 'fp-ts/Option';
import mjml2html from 'mjml';
import {Email} from '../types';
import {sanitizeString} from '../types/html';
import {formatPence} from '../types/money';
import {PurchaseRequest} from '../read-models/shared-state/return-types';
import {NotificationReason, Recipient} from './notification-recipients';

// The email sent about a purchase request; who gets it is decided in
// notification-recipients.ts. It looks like the request pages: a heading,
// the same tags, the details as label/value rows, and a bordered box saying
// why it came to you and what, if anything, to do.

export type NotificationKind =
  | 'new'
  | 'outcome'
  // Approved by someone who had already bought it.
  | 'approved-and-bought'
  // Bought after being approved.
  | 'bought'
  | 'skipped-proposal';

type EmailContext = {
  publicUrl: string;
  areaName: string;
  requesterName: string;
  // Who approved or declined it, for an outcome.
  deciderName: string;
  // Who marked it bought, once bought.
  buyerName: string;
};

// The app's tag colours (src/static/styles.css), mixed out for email.
const TAG_COLOURS = {
  yellow: {background: '#ffee80', text: '#5c5000'},
  red: {background: '#e99a8e', text: '#6a1b0e'},
  green: {background: '#80b89e', text: '#00381e'},
  grey: {background: '#a8adaf', text: '#282d30'},
  blue: {background: '#c7dbed', text: '#11436e'},
  purple: {background: '#e6dfed', text: '#5b2a86'},
} as const;

type Tag = {label: string; colour: keyof typeof TAG_COLOURS};

// The box's border: green when there's something to do, otherwise the
// colour of what happened.
const TONES = {
  action: '#00703c',
  info: '#505a5f',
  approved: '#00703c',
  declined: '#d4351c',
  override: '#5b2a86',
} as const;

type Content = {
  heading: string;
  tags: ReadonlyArray<Tag>;
  intro: string;
  details: ReadonlyArray<readonly [label: string, value: string]>;
  box: {
    tone: keyof typeof TONES;
    title: string;
    lines: ReadonlyArray<string>;
  };
};

const requestUrl = (publicUrl: string, request: PurchaseRequest) =>
  `${publicUrl}/purchase-requests/view/${request.id}`;

const whyYou = (
  reason: NotificationReason,
  {areaName}: EmailContext,
  recipient: Recipient
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
      return `You're an owner in an area it could potentially impact (${recipient.affectedAreas.join(', ')}).`;
    case 'super-user':
      return "You're a super user, and nobody else was set up to hear about it.";
    case 'heard-about-it':
      return 'You were told about this request when it was sent.';
    case 'requester':
      return 'You sent this request.';
  }
};

// As on the pages (src/templates/purchase-request-outcome.ts): "Proposal
// needed" is red only while the request is still waiting.
const outcomeTag = (request: PurchaseRequest): Tag => {
  const base: Tag =
    request.outcome === 'consumable'
      ? {label: 'Paid for by members', colour: 'green'}
      : request.outcome === 'outside-budget'
        ? {label: 'Approved outside the yearly budget', colour: 'blue'}
        : {label: 'Yearly budget', colour: 'yellow'};
  if (request.approval !== 'proposal') {
    return base;
  }
  switch (request.status) {
    case 'awaiting-approval':
      return {label: `${base.label} · Proposal needed`, colour: 'red'};
    case 'approved':
    case 'bought':
      return {...base, label: `${base.label} · Proposal approved`};
    default:
      return base;
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
    case 'approved-and-bought':
      return `Purchase request approved and bought: ${request.summary}`;
    case 'bought':
      return `Purchase request bought: ${request.summary}`;
    case 'skipped-proposal':
      return request.outcome === 'outside-budget'
        ? `Purchase recorded as approved outside the budget: ${request.summary}`
        : `Purchase recorded without a proposal: ${request.summary}`;
  }
};

const FORUM =
  "A manager will arrange a conversation with the owners of the areas it could affect, or it can be raised at an owners' meeting. Once they've agreed, a super user approves or declines it.";

const contentFor = (
  kind: NotificationKind,
  request: PurchaseRequest,
  recipient: Recipient,
  context: EmailContext
): Content => {
  const reasons = recipient.reasons.map(reason =>
    whyYou(reason, context, recipient)
  );
  const details: Content['details'] = [
    ['What', request.summary],
    ['Cost', formatPence(request.totalPence)],
    ['Area', context.areaName],
    ['Requested by', context.requesterName],
    ["Why it's needed", request.justification],
  ];
  switch (kind) {
    case 'new': {
      const director = request.approval === 'proposal';
      const affects = recipient.reasons.includes('affected-area-owner');
      const lines = [
        ...reasons,
        ...(request.affectedAreaIds.length > 0 ? [FORUM] : []),
      ];
      return {
        heading: recipient.canDecide
          ? 'A purchase request needs your approval'
          : affects
            ? 'A purchase request could affect your area'
            : 'A purchase request needs director approval',
        tags: [
          outcomeTag(request),
          {
            label: `Awaiting ${director ? 'director' : 'purchaser'} approval`,
            colour: 'grey',
          },
        ],
        intro: `${context.requesterName} has asked to buy this for ${context.areaName}.`,
        details: director
          ? [
              ...details,
              ['Needs director approval because', request.outcomeReason],
            ]
          : details,
        box: recipient.canDecide
          ? {tone: 'action', title: 'Please approve or decline it.', lines}
          : affects
            ? // Their say is in the conversation, so the box leads with why
              // it concerns them rather than saying there's nothing to do.
              {
                tone: 'action',
                title: whyYou('affected-area-owner', context, recipient),
                lines: lines.filter(
                  line =>
                    line !== whyYou('affected-area-owner', context, recipient)
                ),
              }
            : {tone: 'info', title: "There's nothing you need to do.", lines},
      };
    }
    case 'outcome': {
      const declined = request.status === 'declined';
      const note = declined ? request.declineReason : request.approvalNote;
      return {
        heading: `Purchase request ${declined ? 'declined' : 'approved'}`,
        tags: [
          outcomeTag(request),
          declined
            ? {label: 'Declined', colour: 'red'}
            : {label: 'Approved', colour: 'green'},
        ],
        intro: `${context.deciderName} ${declined ? 'declined' : 'approved'} ${context.requesterName}'s request.`,
        details,
        box: {
          tone: declined ? 'declined' : 'approved',
          title: O.isSome(note)
            ? `${declined ? 'Why' : 'Note'}: ${note.value}`
            : declined
              ? 'Declined.'
              : 'Approved.',
          lines: reasons,
        },
      };
    }
    case 'approved-and-bought':
    case 'bought': {
      const cost = formatPence(
        O.getOrElse(() => request.totalPence)(request.actualCostPence)
      );
      return {
        heading:
          kind === 'bought'
            ? 'Purchase request bought'
            : 'Purchase request approved and bought',
        tags: [outcomeTag(request), {label: 'Bought', colour: 'blue'}],
        intro:
          kind === 'bought'
            ? `${context.buyerName} bought ${context.requesterName}'s request.`
            : `${context.deciderName} approved ${context.requesterName}'s request, and has bought it.`,
        details,
        box: {
          tone: 'approved',
          title: `Bought for ${cost}.`,
          lines: [
            ...(kind === 'approved-and-bought' && O.isSome(request.approvalNote)
              ? [`Note: ${request.approvalNote.value}`]
              : []),
            ...reasons,
          ],
        },
      };
    }
    case 'skipped-proposal': {
      const outside = request.outcome === 'outside-budget';
      return {
        heading: outside
          ? 'Purchase recorded as approved outside the budget'
          : 'Purchase recorded without a proposal',
        tags: [
          outcomeTag(request),
          outside
            ? {label: 'Bought directly', colour: 'blue'}
            : {label: 'Super user override: no proposal', colour: 'purple'},
        ],
        intro: outside
          ? `${context.requesterName} bought this directly, as approved by the directors outside the yearly budget.`
          : `${context.requesterName} bought this directly. As a super user, they went ahead without the proposal it would otherwise need: ${request.outcomeReason}`,
        details,
        box: {
          tone: 'override',
          title: "There's nothing you need to do.",
          lines: reasons,
        },
      };
    }
  }
};

const FONT = "Optima, Candara, 'Noto Sans', 'Segoe UI', sans-serif";
const esc = (text: string) => sanitizeString(text);

const tagHtml = ({label, colour}: Tag) =>
  `<span style="display:inline-block;padding:2px 8px 3px;margin:0 6px 6px 0;background:${TAG_COLOURS[colour].background};color:${TAG_COLOURS[colour].text};font-size:15px;">${esc(label)}</span>`;

const detailsHtml = (details: Content['details']) =>
  details
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;font-weight:bold;width:150px;">${esc(label)}</td>
          <td style="padding:6px 0;vertical-align:top;">${esc(value)}</td>
        </tr>`
    )
    .join('');

const buttonHtml = (url: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td style="background:#00703c;border-bottom:3px solid #0b0c0c;">
        <a href="${url}" style="display:inline-block;padding:10px 20px;color:#ffffff;font-family:${FONT};font-size:19px;text-decoration:none;">View the request</a>
      </td>
    </tr>
  </table>`;

const textVersion = (content: Content, url: string) =>
  [
    content.heading,
    content.tags.map(tag => tag.label).join(' · '),
    content.intro,
    ...content.details.map(([label, value]) => `${label}: ${value}`),
    content.box.title,
    ...content.box.lines,
    `View the request: ${url}`,
  ].join('\n\n');

export const buildNotificationEmail = (
  kind: NotificationKind,
  request: PurchaseRequest,
  recipient: Recipient,
  context: EmailContext
): Email => {
  const content = contentFor(kind, request, recipient, context);
  const url = requestUrl(context.publicUrl, request);
  return {
    recipient: recipient.email,
    subject: notificationSubject(kind, request, recipient),
    text: textVersion(content, url),
    html: mjml2html(`
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="${FONT}" />
            <mj-text font-size="17px" line-height="1.5" color="#0b0c0c" />
          </mj-attributes>
        </mj-head>
        <mj-body width="600px" background-color="#ffffff">
          <mj-section padding="20px 24px 0">
            <mj-column>
              <mj-image src="${context.publicUrl}/static/MS-LOGO-txpt-512.png" alt="Makespace" width="64px" align="left" padding="0" />
            </mj-column>
          </mj-section>
          <mj-section padding="0 24px">
            <mj-column border-bottom="1px solid #b1b4b6" padding-bottom="12px">
              <mj-text padding="0" font-size="14px" color="#505a5f">Makespace purchase requests</mj-text>
            </mj-column>
          </mj-section>
          <mj-section padding="16px 24px 0">
            <mj-column>
              <mj-text padding="0 0 12px" font-size="26px" font-weight="bold" line-height="1.25">${esc(content.heading)}</mj-text>
              <mj-text padding="0 0 8px">${content.tags.map(tagHtml).join('')}</mj-text>
              <mj-text padding="0 0 8px">${esc(content.intro)}</mj-text>
              <mj-text padding="0">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:${FONT};font-size:17px;color:#0b0c0c;">
                  ${detailsHtml(content.details)}
                </table>
              </mj-text>
            </mj-column>
          </mj-section>
          <mj-section padding="20px 24px 0">
            <mj-column border="3px solid ${TONES[content.box.tone]}" padding="16px 20px">
              <mj-text padding="0 0 6px" font-size="19px" font-weight="bold">${esc(content.box.title)}</mj-text>
              ${content.box.lines.map(line => `<mj-text padding="0 0 4px" font-size="16px" color="#3b4145">${esc(line)}</mj-text>`).join('')}
            </mj-column>
          </mj-section>
          <mj-section padding="24px 24px 32px">
            <mj-column>
              <mj-raw>${buttonHtml(url)}</mj-raw>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
  };
};
