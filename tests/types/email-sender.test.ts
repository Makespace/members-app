import {senderAddress, senderName} from '../../src/types/email-sender';

describe('reading a sender header', () => {
  it.each([
    ['Alice Example <alice@example.com>', 'Alice Example', 'alice@example.com'],
    ['"Alice Example" <alice@example.com>', 'Alice Example', 'alice@example.com'],
    ['alice@example.com', 'alice@example.com', 'alice@example.com'],
    [
      `"'Amazon.co.uk' via management" <management@example.org>`,
      `'Amazon.co.uk' via management`,
      'management@example.org',
    ],
  ])('%s', (header, name, address) => {
    expect(senderName(header)).toBe(name);
    expect(senderAddress(header)).toBe(address);
  });
});
