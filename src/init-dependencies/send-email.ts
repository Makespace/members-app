import * as TE from 'fp-ts/TaskEither';
import {Email, failure, Failure} from '../types';
import nodemailer from 'nodemailer';
import {identity, pipe} from 'fp-ts/lib/function';

type SendEmail = (email: Email) => TE.TaskEither<Failure, string>;

export const sendEmail =
  (transporter: nodemailer.Transporter, from: string): SendEmail =>
  email =>
    pipe(
      TE.tryCatch(
        () =>
          transporter.sendMail({
            from,
            to: email.recipient,
            subject: email.subject,
            text: email.text,
            html: email.html,
          }),
        identity
      ),
      TE.bimap(failure('Failed to send email'), () => 'sent email')
    );
