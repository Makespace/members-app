import {parseGmailMessage} from '../../src/sync-worker/gmail/parse-gmail-message';

const b64 = (value: string) => Buffer.from(value, 'utf8').toString('base64url');

describe('parseGmailMessage', () => {
  it('extracts headers, bodies and attachments from a multipart message', () => {
    const parsed = parseGmailMessage({
      id: 'msg-1',
      threadId: 'thread-1',
      snippet: 'Hello there…',
      internalDate: '1789990000000',
      labelIds: ['INBOX', 'UNREAD'],
      payload: {
        mimeType: 'multipart/mixed',
        headers: [
          {name: 'From', value: 'Member <member@example.com>'},
          {name: 'To', value: 'management@makespace.org'},
          {name: 'Subject', value: 'Broken bandsaw'},
          {name: 'Message-ID', value: '<abc@mail.example.com>'},
        ],
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [
              {mimeType: 'text/plain', body: {data: b64('Hello\nworld')}},
              {mimeType: 'text/html', body: {data: b64('<p>Hello</p>')}},
            ],
          },
          {
            mimeType: 'application/pdf',
            filename: 'invoice.pdf',
            body: {attachmentId: 'att-1', size: 12345},
          },
        ],
      },
    });

    expect(parsed).toMatchObject({
      gmailMessageId: 'msg-1',
      gmailThreadId: 'thread-1',
      rfc822MessageId: '<abc@mail.example.com>',
      fromAddress: 'Member <member@example.com>',
      toAddresses: 'management@makespace.org',
      subject: 'Broken bandsaw',
      receivedAt: new Date(1789990000000),
      bodyText: 'Hello\nworld',
      bodyHtml: '<p>Hello</p>',
      attachments: [
        {
          filename: 'invoice.pdf',
          mimeType: 'application/pdf',
          size: 12345,
          attachmentId: 'att-1',
        },
      ],
      labelIds: ['INBOX', 'UNREAD'],
    });
  });

  it('degrades gracefully on a minimal message', () => {
    const parsed = parseGmailMessage({id: 'a', threadId: 'b'});
    expect(parsed).toMatchObject({
      gmailMessageId: 'a',
      bodyText: null,
      bodyHtml: null,
      attachments: [],
      subject: null,
    });
  });

  it('returns null without an id', () => {
    expect(parseGmailMessage({threadId: 'x'})).toBeNull();
  });
});
