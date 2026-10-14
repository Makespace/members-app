import {TroubleTicketStatus} from '../types/trouble-ticket';

// What a trouble ticket looks like in an email.
//
// Kept apart from the card the app draws, because email cannot reach the
// stylesheet: every rule has to travel with the markup. The colours and the
// shape are copied from .trouble-ticket-card and .tt-badge so the two read as
// the same object, and they have to be changed together.

// MJML styles its own blocks and leaves raw markup alone, so anything here
// that does not say otherwise comes out in the mail client's default serif
// beside text that is not. This is what MJML puts on an mj-text, and these
// have to match.
const FONT = 'Ubuntu, Helvetica, Arial, sans-serif';

const TEXT = '#0b0c0c';
const BORDER = '#b1b4b6';
const GREY = '#505a5f';
const MUTED = '#626a6e';

const STATUS_COLOUR: Record<TroubleTicketStatus, {background: string; text: string}> = {
  Todo: {background: GREY, text: '#fff'},
  'In Progress': {background: '#1d70b8', text: '#fff'},
  'Needs Help': {background: '#d4351c', text: '#fff'},
  Parked: {background: '#ffdd00', text: TEXT},
  Resolved: {background: '#00703c', text: '#fff'},
};

export type TicketEmailSummary = {
  title: string;
  status: TroubleTicketStatus;
  // Where it is. Both absent means nobody has matched it to anything yet.
  equipmentName: string | null;
  areaName: string | null;
  rawEquipment: string | null;
  reportedBy: string | null;
  reportedAt: Date;
  // The four answers from the form, as the card lays them out.
  machineStatus: string;
  attempting: string;
  issue: string;
  steps: string;
  url: string;
};

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const statusChip = (status: TroubleTicketStatus): string => {
  const {background, text} = STATUS_COLOUR[status];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${background};color:${text};font-family:${FONT};font-size:13px;font-weight:700;">${escape(
    status
  )}</span>`;
};

// Where a ticket is, said the way the card says it: the machine, and the area
// it sits in, because one without the other rarely tells somebody whether it
// is theirs.
const ticketPlace = (
  summary: Pick<
    TicketEmailSummary,
    'equipmentName' | 'areaName' | 'rawEquipment'
  >
): string => {
  if (summary.equipmentName !== null) {
    return summary.areaName === null
      ? escape(summary.equipmentName)
      : `${escape(summary.equipmentName)} <span style="color:${MUTED};">(${escape(
          summary.areaName
        )})</span>`;
  }
  if (summary.areaName !== null) {
    return `${escape(summary.areaName)} <span style="color:${MUTED};">(area)</span>`;
  }
  return summary.rawEquipment === null || summary.rawEquipment === ''
    ? 'Unassigned'
    : `Unassigned <span style="color:${MUTED};">(form said: ${escape(
        summary.rawEquipment
      )})</span>`;
};

const answer = (label: string, value: string): string =>
  value.trim() === ''
    ? ''
    : `<tr>
         <td style="padding:3px 12px 3px 0;font-family:${FONT};color:${MUTED};vertical-align:top;white-space:nowrap;">${escape(
           label
         )}</td>
         <td style="padding:3px 0;font-family:${FONT};color:${TEXT};">${escape(value)}</td>
       </tr>`;

// The full ticket, for the email that confirms it was logged. The person
// reading it wants to see what we recorded, so it carries their own answers
// back to them rather than making them open the page to check.
export const ticketCardHtml = (summary: TicketEmailSummary): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="border:1px solid ${BORDER};border-left:5px solid ${
           STATUS_COLOUR[summary.status].background
         };border-radius:6px;background:#fff;">
    <tr>
      <td style="padding:14px 18px;">
        <div style="margin-bottom:8px;">${statusChip(summary.status)}</div>
        <div style="font-family:${FONT};font-size:17px;font-weight:700;color:${TEXT};margin-bottom:10px;">
          <a href="${summary.url}" style="color:${TEXT};text-decoration:none;">${escape(
            summary.title === '' ? 'Trouble ticket' : summary.title
          )}</a>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:${FONT};font-size:14px;">
          <tr>
            <td style="padding:3px 12px 3px 0;font-family:${FONT};color:${MUTED};vertical-align:top;white-space:nowrap;">Equipment</td>
            <td style="padding:3px 0;font-family:${FONT};color:${TEXT};">${ticketPlace(summary)}</td>
          </tr>
          ${
            summary.reportedBy === null
              ? ''
              : `<tr>
                   <td style="padding:3px 12px 3px 0;font-family:${FONT};color:${MUTED};vertical-align:top;white-space:nowrap;">Reported by</td>
                   <td style="padding:3px 0;font-family:${FONT};color:${TEXT};">${escape(
                     summary.reportedBy
                   )}</td>
                 </tr>`
          }
          ${answer('Machine status', summary.machineStatus)}
          ${answer('Attempting', summary.attempting)}
          ${answer('Issue', summary.issue)}
          ${answer('Steps taken', summary.steps)}
        </table>
      </td>
    </tr>
  </table>
`;

// The same ticket in a summary email, where several of them sit in a list and
// the point is to scan rather than to read.
export const ticketLineHtml = (
  summary: Pick<
    TicketEmailSummary,
    'title' | 'status' | 'equipmentName' | 'areaName' | 'rawEquipment' | 'url'
  > & {happening: string}
): string => `
  <tr>
    <td style="padding:7px 0;font-family:${FONT};font-size:14px;border-bottom:1px solid #eee;">
      <a href="${summary.url}" style="color:#1d70b8;font-weight:600;text-decoration:none;">${escape(
        summary.title === '' ? 'Trouble ticket' : summary.title
      )}</a>
      <span style="color:${MUTED};"> &mdash; ${escape(summary.happening)}</span>
      <div style="font-family:${FONT};font-size:13px;color:${MUTED};margin-top:2px;">
        ${ticketPlace(summary)}
      </div>
    </td>
    <td style="padding:7px 0 7px 12px;text-align:right;vertical-align:top;white-space:nowrap;">
      ${statusChip(summary.status)}
    </td>
  </tr>
`;

export const ticketUrl = (publicUrl: string, id: string): string =>
  `${publicUrl}/trouble-tickets/view/${encodeURIComponent(id)}`;

// Somebody's first few notifications arrive from a system they have never
// been told about, so those say what it is and where to change it. After
// that they know, and repeating it would be noise on every email forever.
export const INTRO_AFTER_EMAILS = 5;

export const shouldIntroduce = (emailsAlreadySent: number): boolean =>
  emailsAlreadySent < INTRO_AFTER_EMAILS;

// "app.makespace.org", not "https://app.makespace.org/" - the sentence names
// the place rather than quoting an address at somebody.
const siteName = (publicUrl: string) =>
  publicUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

export const introBannerHtml = (publicUrl: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f3f8fb;border:1px solid #b1d4ea;border-radius:6px;margin-bottom:14px;">
    <tr>
      <td style="padding:12px 16px;font-family:${FONT};font-size:14px;color:${TEXT};line-height:1.45;">
        Trouble tickets can now be submitted and tracked in
        <a href="${publicUrl}" style="color:#1d70b8;">${escape(
          siteName(publicUrl)
        )}</a>!
        To edit your notification settings, including following specific
        pieces of equipment only,
        <a href="${publicUrl}/notification-settings" style="color:#1d70b8;">log in to the app</a>.
      </td>
    </tr>
  </table>
`;

export const introBannerText = (publicUrl: string): string =>
  [
    `Trouble tickets can now be submitted and tracked in ${siteName(publicUrl)}!`,
    'To edit your notification settings, including following specific pieces',
    `of equipment only, log in to the app: ${publicUrl}/notification-settings`,
  ].join('\n');
