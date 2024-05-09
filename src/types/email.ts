import {EmailAddress} from './email-address';

export type Email = {
  recipient: EmailAddress;
  subject: string;
  text: string;
  html: string;
};
