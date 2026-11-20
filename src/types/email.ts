import {EmailAddress} from './email-address';

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type Email = {
  recipient: EmailAddress;
  subject: string;
  text: string;
  html: string;
  attachments?: ReadonlyArray<EmailAttachment>;
};
