import mjml2html from 'mjml';
import {DateTime} from 'luxon';
import {Email, EmailAddress} from '../types';
import {
  BORDER,
  escape,
  FONT,
  MUTED,
  TEXT,
} from '../templates/trouble-ticket-email';

// The emails about training sessions: a trainer hearing that somebody joined
// or left one of theirs, and members hearing that one they were booked on is
// off. Drawn like the trouble ticket emails - the orange Makespace band, a
// card with a coloured chip and edge, one green button - so they read as the
// same app writing.

export type TrainingNotificationKind =
  | 'signed-up'
  | 'place-cancelled'
  | 'session-cancelled';

type TrainingEmailContext = {
  publicUrl: string;
  equipmentId: string;
  equipmentName: string;
  startsAt: Date;
  endsAt: Date;
  trainerName: string;
  // Who signed up or gave up their place.
  memberName: string;
  booked: number;
  spaces: number;
  reason: string;
};

const CHIP: Record<
  TrainingNotificationKind,
  {label: string; background: string; text: string}
> = {
  'signed-up': {label: 'New sign-up', background: '#00703c', text: '#fff'},
  'place-cancelled': {
    label: 'Place cancelled',
    background: '#505a5f',
    text: '#fff',
  },
  'session-cancelled': {
    label: 'Training cancelled',
    background: '#d4351c',
    text: '#fff',
  },
};

const sessionWhenText =(startsAt: Date, endsAt: Date): string => {
  const london = (date: Date) =>
    DateTime.fromJSDate(date).setZone('Europe/London').setLocale('en-GB');
  return `${london(startsAt).toFormat('cccc d LLLL, HH:mm')}–${london(
    endsAt
  ).toFormat('HH:mm')}`;
};

const trainingsUrl = (context: TrainingEmailContext) =>
  `${context.publicUrl}/equipment/${context.equipmentId}/trainings`;

const getTrainedUrl = (context: TrainingEmailContext) =>
  `${context.publicUrl}/equipment/${context.equipmentId}/training`;

const row = (label: string, value: string): string =>
  value.trim() === ''
    ? ''
    : `<tr>
         <td style="padding:3px 12px 3px 0;font-family:${FONT};color:${MUTED};vertical-align:top;white-space:nowrap;">${escape(
           label
         )}</td>
         <td style="padding:3px 0;font-family:${FONT};color:${TEXT};">${escape(value)}</td>
       </tr>`;

type Content = {
  subject: string;
  opening: string;
  title: string;
  rows: ReadonlyArray<readonly [string, string]>;
  button: {label: string; url: string};
};

const contentFor = (
  kind: TrainingNotificationKind,
  context: TrainingEmailContext
): Content => {
  const when = sessionWhenText(context.startsAt, context.endsAt);
  const booked = `${context.booked} of ${context.spaces}`;
  switch (kind) {
    case 'signed-up':
      return {
        subject: `${context.memberName} signed up for your ${context.equipmentName} training`,
        opening: `${context.memberName} has signed up for your training on ${context.equipmentName}.`,
        title: `${context.equipmentName} training`,
        rows: [
          ['When', when],
          ['Signed up', context.memberName],
          ['Booked', booked],
        ],
        button: {label: 'View your trainings', url: trainingsUrl(context)},
      };
    case 'place-cancelled':
      return {
        subject: `${context.memberName} cancelled their place on your ${context.equipmentName} training`,
        opening: `${context.memberName} has cancelled their place on your training on ${context.equipmentName}. Their space is open for somebody else.`,
        title: `${context.equipmentName} training`,
        rows: [
          ['When', when],
          ['Cancelled', context.memberName],
          ['Booked', booked],
        ],
        button: {label: 'View your trainings', url: trainingsUrl(context)},
      };
    case 'session-cancelled':
      return {
        subject: `Cancelled: ${context.equipmentName} training on ${DateTime.fromJSDate(
          context.startsAt
        )
          .setZone('Europe/London')
          .setLocale('en-GB')
          .toFormat('ccc d LLL')}`,
        opening: `The ${context.equipmentName} training you were booked on has been cancelled. Sorry about that.`,
        title: `${context.equipmentName} training`,
        rows: [
          ['When', when],
          ['Trainer', context.trainerName],
          ['Reason', context.reason],
        ],
        button: {label: 'Find another training', url: getTrainedUrl(context)},
      };
  }
};

const cardHtml = (
  kind: TrainingNotificationKind,
  content: Content
): string => {
  const chip = CHIP[kind];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="border:1px solid ${BORDER};border-left:5px solid ${chip.background};border-radius:6px;background:#fff;">
    <tr>
      <td style="padding:14px 18px;">
        <div style="margin-bottom:8px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${chip.background};color:${chip.text};font-family:${FONT};font-size:13px;font-weight:700;">${escape(
          chip.label
        )}</span></div>
        <div style="font-family:${FONT};font-size:17px;font-weight:700;color:${TEXT};margin-bottom:10px;">
          <a href="${content.button.url}" style="color:${TEXT};text-decoration:none;">${escape(
            content.title
          )}</a>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:${FONT};font-size:14px;">
          ${content.rows.map(([label, value]) => row(label, value)).join('')}
        </table>
      </td>
    </tr>
  </table>
`;
};

export const buildTrainingNotificationEmail = (
  kind: TrainingNotificationKind,
  recipient: EmailAddress,
  context: TrainingEmailContext
): Email => {
  const content = contentFor(kind, context);
  return {
    recipient,
    subject: content.subject,
    text: [
      content.opening,
      '',
      ...content.rows
        .filter(([, value]) => value.trim() !== '')
        .map(([label, value]) => `${label}: ${value}`),
      '',
      `${content.button.label}: ${content.button.url}`,
    ].join('\n'),
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
                <p>${escape(content.opening)}</p>
              </mj-text>
              <mj-raw>${cardHtml(kind, content)}</mj-raw>
              <mj-button background-color="#00703c" href="${content.button.url}">${escape(
                content.button.label
              )}</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
  };
};
