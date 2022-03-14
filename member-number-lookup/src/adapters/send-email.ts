import * as TE from 'fp-ts/TaskEither';
import {EmailAddress} from '../types';
import nodemailer from 'nodemailer';
import {identity, pipe} from 'fp-ts/lib/function';

type SendEmail = (
  emailAddress: EmailAddress,
  message: string
) => TE.TaskEither<string, string>;

const transporter = nodemailer.createTransport({
  host: 'mailcatcher',
  port: 1025,
  secure: false,
});

export const sendEmail = (): SendEmail => (email, message) =>
  pipe(
    TE.tryCatch(
      () =>
        transporter.sendMail({
          from: '"Makespace Member Number Service" <do-not-reply@makespace.org>',
          to: email,
          subject: 'Hello',
          text: message,
        }),
      identity
    ),
    TE.bimap(
      () => 'failed to send email',
      () => 'sent email'
    )
  );
