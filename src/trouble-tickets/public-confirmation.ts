import mjml2html from 'mjml';
import {Email} from '../types';
import {EmailAddress} from '../types/email-address';

// The confirmation of a report made without logging in. Anybody can type any
// address into that form, so this email must be no use to somebody wanting to
// send a stranger a message from Makespace: nothing the reporter typed goes
// back out - not their answers, not their name, not their description of an
// unlisted machine. What it carries is ours: the machine as we name it, the
// member number on the account, and links into the app.

type PublicConfirmation = {
  recipient: EmailAddress;
  // The machine as listed, or the area; null for something not on the list.
  equipment: string | null;
  // The account the address belongs to, if it belongs to one.
  memberNumber: number | null;
  // What they typed in the member number box, if anything.
  providedMemberNumber: number | null;
  ticketUrl: string;
  // Lets whoever reads this inbox put the ticket on their account.
  claimUrl: string;
};

const about = (confirmation: PublicConfirmation) =>
  confirmation.equipment === null
    ? 'equipment that isn’t on our list'
    : `the ${confirmation.equipment}`;

const publicConfirmationSubject = (confirmation: PublicConfirmation) =>
  `We've logged your report about ${about(confirmation)}`;

// The paragraphs, plain. The HTML version is the same words.
const publicConfirmationParagraphs = (
  confirmation: PublicConfirmation
): ReadonlyArray<string> => {
  const opening = [
    `We've logged your report about ${about(confirmation)}. One of the owners of the equipment will address it soon.`,
    'If the equipment is not useable, or is unsafe, please put a sign on it telling other members, and consider a post on the Google group.',
  ];
  if (confirmation.memberNumber !== null) {
    const differs =
      confirmation.providedMemberNumber !== null &&
      confirmation.providedMemberNumber !== confirmation.memberNumber;
    return [
      ...opening,
      `Your member number is ${confirmation.memberNumber}. It's worth knowing: you can log in to the app with it, and it's the quickest way for anybody at Makespace to find you.${
        differs
          ? ` (The form said ${confirmation.providedMemberNumber}, but this email address is on the account for member ${confirmation.memberNumber}.)`
          : ''
      }`,
      `The report is on your account. See this ticket: ${confirmation.ticketUrl}`,
    ];
  }
  const whose =
    confirmation.providedMemberNumber === null
      ? "This email address isn't on a Makespace member's account"
      : `This email address isn't on the account for member ${confirmation.providedMemberNumber}`;
  return [
    ...opening,
    `${whose}, so the report isn't on your account yet. If you're a member, follow this link and log in, and we'll add it to your account - you'll see how it's going in the app and hear about updates: ${confirmation.claimUrl}`,
    "You'll be offered the chance to add this email address to your account at the same time, so we recognise it next time.",
  ];
};

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Links in the plain paragraphs become proper links in the HTML.
const linkify = (paragraph: string) =>
  escape(paragraph).replace(
    /(https?:\/\/[^\s<]+)/g,
    url => `<a href="${url}" style="color:#1d70b8;">${url}</a>`
  );

export const publicConfirmationEmail = (
  confirmation: PublicConfirmation
): Email => {
  const paragraphs = publicConfirmationParagraphs(confirmation);
  const button =
    confirmation.memberNumber === null
      ? {href: confirmation.claimUrl, label: 'Add it to my account'}
      : {href: confirmation.ticketUrl, label: 'View this ticket'};
  return {
    recipient: confirmation.recipient,
    subject: publicConfirmationSubject(confirmation),
    text: `Hi,\n\n${paragraphs.join('\n\n')}\n`,
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
                <p>Hi,</p>
                ${paragraphs.map(paragraph => `<p>${linkify(paragraph)}</p>`).join('\n')}
              </mj-text>
              <mj-button background-color="#00703c" href="${button.href}">${button.label}</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
  };
};
