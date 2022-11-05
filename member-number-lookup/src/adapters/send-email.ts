import * as TE from 'fp-ts/TaskEither';
import {Email, failure, Failure} from '../types';
import nodemailer from 'nodemailer';
import {identity, pipe} from 'fp-ts/lib/function';

type SendEmail = (email: Email) => TE.TaskEither<Failure, string>;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '25'),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export const sendEmail = (): SendEmail => email =>
  pipe(
    TE.tryCatch(
      () =>
        transporter.sendMail({
          member-number-lookup@
          from: '"Member number lookup" <member-number-lookup@makespace.org>',
          to: email.recipient,
          subject: email.subject,
          text: email.message,
        }),
      identity
    ),
    TE.bimap(failure('Failed to send email'), () => 'sent email')
  );
