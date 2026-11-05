import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {PurchaseReceipt} from '../return-types';

// How a purchase request's uploaded receipts are kept in its receiptsJson.
const StoredPurchaseReceiptCodec = t.strict({
  fileId: tt.UUID,
  filename: t.string,
  mimeType: t.string,
  sizeBytes: t.number,
  uploadedAtMs: t.number,
  uploadedByMemberNumber: t.union([t.number, t.null]),
});

export type StoredPurchaseReceipt = t.TypeOf<typeof StoredPurchaseReceiptCodec>;

export const receiptsFromJson = (json: string): ReadonlyArray<PurchaseReceipt> =>
  pipe(
    t.readonlyArray(StoredPurchaseReceiptCodec).decode(JSON.parse(json)),
    E.getOrElse((): ReadonlyArray<StoredPurchaseReceipt> => [])
  ).map(({uploadedAtMs, uploadedByMemberNumber, ...receipt}) => ({
    ...receipt,
    uploadedAt: new Date(uploadedAtMs),
    uploadedByMemberNumber: O.fromNullable(uploadedByMemberNumber),
  }));
