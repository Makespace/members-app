import {EmailAddress} from './email-address';

export type Email = {
  recipient: EmailAddress;
  subject: string;
  message: string;
};
