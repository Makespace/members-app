import {Client} from '@libsql/client';
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {dbExecute} from '../util';

// Receipts and invoices uploaded for bought purchases. The bytes live here,
// in the event database (so they're persisted and backed up with it), not in
// the event log: the PurchaseRequestReceiptUploaded event records only each
// file's id, name, type and size. A file stored without its event (if
// committing the event failed) is simply never linked to.

export const MAX_RECEIPT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPT_FILES = 5;
// For the file picker; the content is checked on upload (receiptTypeOf).
export const RECEIPT_ACCEPT = 'image/*,application/pdf,.pdf,.heic';

// Where an uploaded receipt is served from, for those who may see it.
export const receiptFilePath = (requestId: UUID, fileId: UUID) =>
  `/purchase-requests/view/${requestId}/receipts/${fileId}`;

type ReceiptFile = {
  fileId: UUID;
  purchaseRequestId: UUID;
  filename: string;
  mimeType: string;
  content: Buffer;
};

export type ReceiptFileStore = {
  store: (file: ReceiptFile) => Promise<void>;
  get: (fileId: UUID) => Promise<O.Option<ReceiptFile>>;
};

const startsWith = (content: Buffer, bytes: ReadonlyArray<number>, at = 0) =>
  content.length >= at + bytes.length &&
  bytes.every((byte, i) => content[at + i] === byte);

const ascii = (text: string) => [...text].map(c => c.charCodeAt(0));

// What a file really is, judged by its first bytes rather than by its name
// or the type the browser claimed: an image or a PDF, or nothing. Only these
// are kept, and they're served back as exactly this type, so nothing
// uploaded can run as a page on the site.
export const receiptTypeOf = (content: Buffer): O.Option<string> => {
  if (startsWith(content, ascii('%PDF-'))) {
    return O.some('application/pdf');
  }
  if (startsWith(content, [0xff, 0xd8, 0xff])) {
    return O.some('image/jpeg');
  }
  if (startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return O.some('image/png');
  }
  if (startsWith(content, ascii('GIF87a')) || startsWith(content, ascii('GIF89a'))) {
    return O.some('image/gif');
  }
  if (startsWith(content, ascii('RIFF')) && startsWith(content, ascii('WEBP'), 8)) {
    return O.some('image/webp');
  }
  // iPhone photos.
  if (
    startsWith(content, ascii('ftyp'), 4) &&
    ['heic', 'heix', 'mif1', 'msf1'].some(brand =>
      startsWith(content, ascii(brand), 8)
    )
  ) {
    return O.some('image/heic');
  }
  return O.none;
};

// A name that's safe to show and to put in a Content-Disposition header.
export const cleanFilename = (name: string): string => {
  const cleaned = name
    // Browsers send the bare name, but some old ones send a whole path.
    .split(/[\\/]/)
    .pop()!
    .replace(/[^\p{L}\p{N} ._()-]/gu, '_')
    .trim()
    .slice(0, 120);
  return cleaned === '' ? 'receipt' : cleaned;
};

const ensureReceiptFilesTableExists = (eventDB: Client) => () =>
  dbExecute(
    eventDB,
    `
    CREATE TABLE IF NOT EXISTS purchase_receipt_files (
      file_id TEXT PRIMARY KEY,
      purchase_request_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      content BLOB NOT NULL,
      stored_at_unix_ms INTEGER NOT NULL
    );
    `,
    {}
  ).then(() => undefined);

export const receiptFileStore = (eventDB: Client): ReceiptFileStore => {
  // Created on first use, so neither process needs to remember to.
  let ready: Promise<void> | undefined;
  const ensureTable = () => {
    ready ??= ensureReceiptFilesTableExists(eventDB)().catch(err => {
      ready = undefined;
      throw err;
    });
    return ready;
  };
  return {
    store: async file => {
      await ensureTable();
      await dbExecute(
        eventDB,
        `INSERT INTO purchase_receipt_files
          (file_id, purchase_request_id, filename, mime_type, content, stored_at_unix_ms)
          VALUES ($fileId, $purchaseRequestId, $filename, $mimeType, $content, $storedAt)`,
        {
          fileId: file.fileId,
          purchaseRequestId: file.purchaseRequestId,
          filename: file.filename,
          mimeType: file.mimeType,
          content: file.content,
          storedAt: Date.now(),
        }
      );
    },
    get: async fileId => {
      await ensureTable();
      const result = await dbExecute(
        eventDB,
        `SELECT file_id, purchase_request_id, filename, mime_type, content
          FROM purchase_receipt_files WHERE file_id = $fileId`,
        {fileId}
      );
      const row = result.rows[0];
      if (row === undefined) {
        return O.none;
      }
      const content = row.content;
      const text = (value: unknown) => (typeof value === 'string' ? value : '');
      return O.some({
        fileId: text(row.file_id) as UUID,
        purchaseRequestId: text(row.purchase_request_id) as UUID,
        filename: text(row.filename),
        mimeType: text(row.mime_type),
        content: Buffer.from(
          content instanceof ArrayBuffer
            ? new Uint8Array(content)
            : (content as unknown as Uint8Array)
        ),
      });
    },
  };
};
