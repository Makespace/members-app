import * as O from 'fp-ts/Option';
import * as libsqlClient from '@libsql/client';
import {UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {
  cleanFilename,
  receiptFileStore,
  receiptTypeOf,
} from '../../src/purchasing/receipt-files';

const bytes = (...parts: ReadonlyArray<string | ReadonlyArray<number>>) =>
  Buffer.concat(
    parts.map(part =>
      typeof part === 'string' ? Buffer.from(part, 'latin1') : Buffer.from(part)
    )
  );

describe('receipt files', () => {
  describe('what a file really is', () => {
    it.each([
      ['a PDF', bytes('%PDF-1.7\n...'), 'application/pdf'],
      ['a JPEG', bytes([0xff, 0xd8, 0xff, 0xe0], 'JFIF'), 'image/jpeg'],
      [
        'a PNG',
        bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], '...'),
        'image/png',
      ],
      ['a GIF', bytes('GIF89a...'), 'image/gif'],
      ['a WebP', bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '), 'image/webp'],
      ['an iPhone photo', bytes([0, 0, 0, 0x18], 'ftypheic'), 'image/heic'],
    ])('recognises %s by its content', (_name, content, type) => {
      expect(receiptTypeOf(content)).toStrictEqual(O.some(type));
    });

    it.each([
      ['a web page', bytes('<html><script>alert(1)</script>')],
      ['an SVG', bytes('<svg xmlns="http://www.w3.org/2000/svg">')],
      ['an empty file', bytes('')],
    ])('refuses %s', (_name, content) => {
      expect(receiptTypeOf(content)).toStrictEqual(O.none);
    });
  });

  it('keeps just a safe name for the file', () => {
    expect(cleanFilename('C:\\Users\\me\\Receipt (1).pdf')).toBe(
      'Receipt (1).pdf'
    );
    expect(cleanFilename('in"voice;\r\n.pdf')).toBe('in_voice___.pdf');
    expect(cleanFilename('')).toBe('receipt');
  });

  it('stores and returns a file', async () => {
    const store = receiptFileStore(libsqlClient.createClient({url: ':memory:'}));
    const file = {
      fileId: faker.string.uuid() as UUID,
      purchaseRequestId: faker.string.uuid() as UUID,
      filename: 'receipt.pdf',
      mimeType: 'application/pdf',
      content: bytes('%PDF-1.4 receipt', [0, 255, 10]),
    };
    await store.store(file);
    expect(await store.get(file.fileId)).toStrictEqual(O.some(file));
    expect(await store.get(faker.string.uuid() as UUID)).toStrictEqual(O.none);
  });
});
