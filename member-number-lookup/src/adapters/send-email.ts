import * as TE from 'fp-ts/TaskEither';
import {Email, failure, Failure} from '../types';
import nodemailer from 'nodemailer';
import {identity, pipe} from 'fp-ts/lib/function';

type SendEmail = (email: Email) => TE.TaskEither<Failure, string>;

export const sendEmail =
  (transporter: nodemailer.Transporter): SendEmail =>
  email =>
    pipe(
      TE.tryCatch(
        () =>
          transporter.sendMail({
            from: 'member-number-lookup@makespace.org',
            to: email.recipient,
            subject: email.subject,
            text: email.message,
          }),
        identity
      ),
      TE.bimap(failure('Failed to send email'), () => 'sent email')
    );
