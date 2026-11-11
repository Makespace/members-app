import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {Form} from '../../types/form';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContentWithBackLink,
} from '../../types/html';
import {formatPence} from '../../types/money';
import {PurchaseRequest} from '../../read-models/shared-state/return-types';
import {displayDate} from '../../templates/display-date';
import {
  MAX_RECEIPT_FILES,
  RECEIPT_ACCEPT,
} from '../../purchasing/receipt-files';
import {decisionAction, receiptFromParams, requestPath} from './decide-helpers';

type ReceiptPageViewModel = {
  request: PurchaseRequest;
  // Where uploads are emailed, for the accountant.
  receiptsEmail: string;
};

const renderUploaded = (request: PurchaseRequest) =>
  request.receipts.length === 0
    ? html``
    : html`<div>
        <p><strong>Already uploaded:</strong></p>
        <ul>
          ${joinHtml(
            request.receipts.map(
              receipt =>
                html`<li>
                  ${sanitizeString(receipt.filename)}
                  (${displayDate(DateTime.fromJSDate(receipt.uploadedAt))})
                </li>`
            )
          )}
        </ul>
      </div>`;

// The receipt step: straight after marking something bought, or later from
// the request page when the invoice turns up. Upload it to have it emailed
// to the accountant, or say it's already gone to them another way.
const renderForm = ({request, receiptsEmail}: ReceiptPageViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Send the receipt or invoice to the accountant</h1>
        <p>
          <b>${sanitizeString(request.summary)}</b>, bought for
          ${sanitizeString(
            formatPence(
              O.getOrElse(() => request.totalPence)(request.actualCostPence)
            )
          )}.
        </p>
        ${pipe(
          request.invoiceSentAt,
          O.match(
            () => html``,
            at =>
              html`<p>
                Already sent on ${displayDate(DateTime.fromJSDate(at))}. You
                can still upload anything else, such as an invoice that came
                later.
              </p>`
          )
        )}
        ${renderUploaded(request)}
        <form
          action="${safe(decisionAction('upload-receipt', request.id))}"
          method="post"
          enctype="multipart/form-data"
          class="stack"
        >
          <h2>Upload it</h2>
          <label for="files">Photos or PDFs of the receipt or invoice</label>
          <p class="text-sm">
            Up to ${MAX_RECEIPT_FILES} files, each no bigger than 10 MB. They're
            emailed to ${sanitizeString(receiptsEmail)} for the accountant, with
            a link to this request.
          </p>
          <input
            type="file"
            name="files"
            id="files"
            accept="${safe(RECEIPT_ACCEPT)}"
            multiple
            required
          />
          <input type="hidden" name="id" value="${request.id}" />
          <div>
            <button type="submit">Upload and send</button>
          </div>
        </form>
        ${O.isNone(request.invoiceSentAt)
          ? html`<form
              action="${safe(decisionAction('mark-invoice-sent', request.id))}"
              method="post"
              class="stack"
            >
              <h2>Or, if it's already with the accountant</h2>
              <p>
                If you've handed it over or emailed it yourself, mark it as
                sent so it's off your list and everyone can see it's done.
              </p>
              <input type="hidden" name="id" value="${request.id}" />
              <div>
                <button type="submit">
                  I've sent it another way
                </button>
              </div>
            </form>`
          : html``}
        <p>
          <a href="${safe(requestPath(request.id))}"
            >Not now - back to the request</a
          >
        </p>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Send receipt or invoice'), {
      href: requestPath(request.id),
      label: request.summary,
    })
  );

export const markInvoiceSentForm: Form<ReceiptPageViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel, user, deps}) =>
      pipe(
        receiptFromParams(readModel, input, user),
        TE.fromEither,
        TE.map(({request}) => ({
          request,
          receiptsEmail: deps.conf.PURCHASE_RECEIPTS_EMAIL,
        }))
      ),
  // Checked against the request itself, in receiptFromParams.
  formIsAuthorized: null,
};
