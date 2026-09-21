// Pure extraction from the Gmail API's users.messages.get (format=full)
// payload shape into a cache row. Kept dependency-free and total: anything
// missing degrades to null/''.

type GmailHeader = {name?: string | null; value?: string | null};

type GmailMessagePart = {
  mimeType?: string | null;
  filename?: string | null;
  headers?: GmailHeader[] | null;
  body?: {
    data?: string | null;
    size?: number | null;
    attachmentId?: string | null;
  } | null;
  parts?: GmailMessagePart[] | null;
};

export type GmailApiMessage = {
  id?: string | null;
  threadId?: string | null;
  snippet?: string | null;
  internalDate?: string | null;
  labelIds?: string[] | null;
  payload?: GmailMessagePart | null;
};

export type ParsedGmailMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  rfc822MessageId: string | null;
  fromAddress: string | null;
  toAddresses: string | null;
  ccAddresses: string | null;
  deliveredTo: string | null;
  subject: string | null;
  receivedAt: Date;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: ReadonlyArray<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
  labelIds: ReadonlyArray<string>;
};

const header = (part: GmailMessagePart | null | undefined, name: string) =>
  part?.headers?.find(
    candidate => candidate.name?.toLowerCase() === name.toLowerCase()
  )?.value ?? null;

const decodeBody = (data: string | null | undefined): string | null => {
  if (!data) {
    return null;
  }
  try {
    return Buffer.from(data, 'base64url').toString('utf8');
  } catch {
    return null;
  }
};

// Walks the MIME tree collecting the first text/plain and text/html bodies
// and every attachment's metadata.
const walk = (
  part: GmailMessagePart | null | undefined,
  found: {
    text: string | null;
    html: string | null;
    attachments: Array<ParsedGmailMessage['attachments'][number]>;
  }
): void => {
  if (!part) {
    return;
  }
  if (part.filename && part.body?.attachmentId) {
    found.attachments.push({
      filename: part.filename,
      mimeType: part.mimeType ?? 'application/octet-stream',
      size: part.body.size ?? 0,
      attachmentId: part.body.attachmentId,
    });
  } else if (part.mimeType === 'text/plain' && found.text === null) {
    found.text = decodeBody(part.body?.data);
  } else if (part.mimeType === 'text/html' && found.html === null) {
    found.html = decodeBody(part.body?.data);
  }
  for (const child of part.parts ?? []) {
    walk(child, found);
  }
};

// null when the message is unusable (no id/thread - never seen in practice).
export const parseGmailMessage = (
  message: GmailApiMessage
): ParsedGmailMessage | null => {
  if (!message.id || !message.threadId) {
    return null;
  }
  const found: {
    text: string | null;
    html: string | null;
    attachments: Array<ParsedGmailMessage['attachments'][number]>;
  } = {text: null, html: null, attachments: []};
  walk(message.payload, found);
  const internalMs = Number(message.internalDate ?? NaN);
  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId,
    rfc822MessageId: header(message.payload, 'Message-ID'),
    fromAddress: header(message.payload, 'From'),
    toAddresses: header(message.payload, 'To'),
    ccAddresses: header(message.payload, 'Cc'),
    deliveredTo: header(message.payload, 'Delivered-To'),
    subject: header(message.payload, 'Subject'),
    receivedAt: Number.isFinite(internalMs)
      ? new Date(internalMs)
      : new Date(0),
    snippet: message.snippet ?? null,
    bodyText: found.text,
    bodyHtml: found.html,
    attachments: found.attachments,
    labelIds: message.labelIds ?? [],
  };
};
