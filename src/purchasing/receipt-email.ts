import * as O from 'fp-ts/Option';
import mjml2html from 'mjml';
import {Email, EmailAttachment} from '../types/email';
import {EmailAddress} from '../types/email-address';
import {sanitizeString} from '../types/html';
import {formatPence} from '../types/money';
import {PurchaseRequest} from '../read-models/shared-state/return-types';
import {receiptFilePath} from './receipt-files';

// Emailed to PURCHASE_RECEIPTS_EMAIL (management@) when someone uploads a
// purchase's receipt or invoice, for the accountant: what was bought, links
// to the request and to each file, and the files themselves when they're
// small enough to attach.

// Comfortably inside the mail provider's limit for a whole message.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type UploadedFile = {
  fileId: PurchaseRequest['receipts'][number]['fileId'];
  filename: string;
};

type ReceiptEmailContext = {
  publicUrl: string;
  to: EmailAddress;
  areaName: string;
  uploaderName: string;
  buyerName: string;
};

const FONT = "Optima, Candara, 'Noto Sans', 'Segoe UI', sans-serif";
const esc = (text: string) => sanitizeString(text);

const costOf = (request: PurchaseRequest) =>
  formatPence(O.getOrElse(() => request.totalPence)(request.actualCostPence));

export const buildReceiptEmail = (
  request: PurchaseRequest,
  files: ReadonlyArray<UploadedFile>,
  attachments: ReadonlyArray<EmailAttachment>,
  context: ReceiptEmailContext
): Email => {
  const requestUrl = `${context.publicUrl}/purchase-requests/view/${request.id}`;
  const fileLinks = files.map(file => ({
    filename: file.filename,
    url: `${context.publicUrl}${receiptFilePath(request.id, file.fileId)}`,
  }));
  const what = files.length === 1 ? 'receipt or invoice' : 'receipts or invoices';
  const details: ReadonlyArray<readonly [string, string]> = [
    ['Purchase', request.summary],
    ['Cost', costOf(request)],
    ['Area', context.areaName],
    ['Bought by', context.buyerName],
    ['Uploaded by', context.uploaderName],
  ];
  const attachedNote =
    attachments.length === files.length
      ? `The ${files.length === 1 ? 'file is' : 'files are'} attached, and also linked below.`
      : 'The files were too big to attach, so they are linked below. You need to log in to the app to open them.';
  return {
    recipient: context.to,
    subject: `Receipt for purchase: ${request.summary} (${costOf(request)})`,
    text: [
      `${context.uploaderName} uploaded the ${what} for a purchase, for the accountant.`,
      ...details.map(([label, value]) => `${label}: ${value}`),
      attachedNote,
      ...fileLinks.map(link => `${link.filename}: ${link.url}`),
      `View the purchase request: ${requestUrl}`,
    ].join('\n\n'),
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
              <mj-text padding="0 0 12px" font-size="26px" font-weight="bold" line-height="1.25">${esc(`Receipt for ${request.summary}`)}</mj-text>
              <mj-text padding="0 0 8px">${esc(`${context.uploaderName} uploaded the ${what} for this purchase, for the accountant.`)}</mj-text>
              <mj-text padding="0 0 8px">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:${FONT};font-size:17px;color:#0b0c0c;">
                  ${details
                    .map(
                      ([label, value]) => `
                    <tr>
                      <td style="padding:6px 12px 6px 0;vertical-align:top;font-weight:bold;width:150px;">${esc(label)}</td>
                      <td style="padding:6px 0;vertical-align:top;">${esc(value)}</td>
                    </tr>`
                    )
                    .join('')}
                </table>
              </mj-text>
              <mj-text padding="8px 0 0">${esc(attachedNote)}</mj-text>
              <mj-text padding="0 0 12px">
                <ul style="margin:0;padding-left:20px;">
                  ${fileLinks
                    .map(
                      link =>
                        `<li><a href="${esc(link.url)}" style="color:#1d70b8;">${esc(link.filename)}</a></li>`
                    )
                    .join('')}
                </ul>
              </mj-text>
              <mj-text padding="0 0 24px">
                <a href="${esc(requestUrl)}" style="display:inline-block;padding:10px 20px;background:#00703c;border-bottom:3px solid #0b0c0c;color:#ffffff;font-size:19px;text-decoration:none;">View the purchase request</a>
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
    attachments,
  };
};
