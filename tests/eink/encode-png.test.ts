import {inflateSync} from 'node:zlib';
import {encodeGreyPng} from '../../src/eink/encode-png';

// Reads back the pieces of a PNG this encoder writes: one IHDR, one IDAT.
const decode = (png: Buffer) => {
  const chunks = new Map<string, Buffer>();
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    chunks.set(type, png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  return chunks;
};

describe('encodeGreyPng with 2 bits', () => {
  it('writes a 2-bit greyscale PNG of the given size', () => {
    const png = encodeGreyPng(5, 2, new Uint8Array(10), 2);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    const header = decode(png).get('IHDR')!;
    expect(header.readUInt32BE(0)).toBe(5);
    expect(header.readUInt32BE(4)).toBe(2);
    expect(header[8]).toBe(2);
    expect(header[9]).toBe(0);
  });

  it('packs four pixels to a byte, most significant first, each row filtered none', () => {
    const levels = new Uint8Array([0, 1, 2, 3, 3, 3, 2, 1, 0, 0]);
    const raw = inflateSync(decode(encodeGreyPng(5, 2, levels, 2)).get('IDAT')!);
    expect([...raw]).toEqual([
      0,
      0b00011011,
      0b11000000,
      0,
      0b11100100,
      0b00000000,
    ]);
  });
});

describe('encodeGreyPng with 1 bit', () => {
  it('writes a 1-bit greyscale PNG of the given size', () => {
    const header = decode(encodeGreyPng(10, 2, new Uint8Array(20), 1)).get(
      'IHDR'
    )!;
    expect(header.readUInt32BE(0)).toBe(10);
    expect(header.readUInt32BE(4)).toBe(2);
    expect(header[8]).toBe(1);
    expect(header[9]).toBe(0);
  });

  it('packs eight pixels to a byte, most significant first, each row filtered none', () => {
    const levels = new Uint8Array([
      0, 1, 0, 1, 1, 1, 0, 0, 1, 1,
      1, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ]);
    const raw = inflateSync(decode(encodeGreyPng(10, 2, levels, 1)).get('IDAT')!);
    expect([...raw]).toEqual([
      0,
      0b01011100,
      0b11000000,
      0,
      0b10000000,
      0b01000000,
    ]);
  });
});
