import * as TE from 'fp-ts/TaskEither';
import {Email, failure, Failure} from '../types';
import nodemailer from 'nodemailer';
import {identity, pipe} from 'fp-ts/lib/function';

type SendEmail = (email: Email) => TE.TaskEither<Failure, string>;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '25'),
  secure: process.env.SMTP_SECURE !== 'false',
});

export const sendEmail = (): SendEmail => email =>
  pipe(
    TE.tryCatch(
      () =>
        transporter.sendMail({
          from: '"Makespace Member Number Service" <do-not-reply@makespace.org>',
          to: email.recipient,
          subject: email.subject,
          text: email.message,
        }),
      identity
    ),
    TE.bimap(failure('Failed to send email'), () => 'sent email')
  );
