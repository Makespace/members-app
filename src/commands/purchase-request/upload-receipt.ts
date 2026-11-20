import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {Command} from '../command';
import {canMarkInvoiceSent} from '../../purchasing/permissions';
import {
  MAX_RECEIPT_FILE_BYTES,
  MAX_RECEIPT_FILES,
} from '../../purchasing/receipt-files';
import {requestBought} from './decide-helpers';

const codec = t.strict({
  id: tt.UUID,
  // Already stored (see purchasing/receipt-routes), and checked to be images
  // or PDFs by their content.
  files: t.readonlyArray(
    t.strict({
      fileId: tt.UUID,
      filename: t.string,
      mimeType: t.string,
      sizeBytes: t.number,
    })
  ),
});

type UploadReceipt = t.TypeOf<typeof codec>;

const fail = (message: string) =>
  failureWithStatus(message, StatusCodes.BAD_REQUEST)();

// Recording receipts or invoices uploaded for a bought purchase. The sync
// worker emails them on to the Treasurer, so this also marks it as sent.
// More can be uploaded after that, e.g. an invoice that came later.
const process: Command<UploadReceipt>['process'] = input =>
  pipe(
    requestBought(input.rm, input.command.id),
    E.filterOrElse(
      () => input.command.files.length > 0,
      () => fail('Please choose a receipt or invoice to upload.')
    ),
    E.filterOrElse(
      () => input.command.files.length <= MAX_RECEIPT_FILES,
      () => fail(`Please upload at most ${MAX_RECEIPT_FILES} files at a time.`)
    ),
    E.filterOrElse(
      () =>
        input.command.files.every(
          file => file.sizeBytes > 0 && file.sizeBytes <= MAX_RECEIPT_FILE_BYTES
        ),
      () => fail('Each file must be no bigger than 10 MB.')
    ),
    TE.fromEither,
    TE.map(request =>
      O.some(
        constructEvent('PurchaseRequestReceiptUploaded')({
          id: request.id,
          files: input.command.files,
          actor: input.command.actor,
        })
      )
    )
  );

export const uploadReceipt: Command<UploadReceipt> = {
  process,
  decode: codec.decode,
  // Whoever bought it, the area's purchasers and super users.
  isAuthorized: ({actor, rm, input}) =>
    pipe(
      rm.purchasing.getRequest(input.id),
      O.exists(request => canMarkInvoiceSent(rm, actor, request))
    ),
};
