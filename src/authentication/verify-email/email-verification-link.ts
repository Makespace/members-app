import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {Config} from '../../configuration';
import {EmailAddressCodec, User} from '../../types';
import {Logger} from 'pino';
import { createSignedToken, verifyToken } from '../signed-token';
import {Request} from 'express'; 
import { logPassThru } from '../../util';

const VerifyEmailTokenPayload = t.strict({
  memberNumber: t.number,
  emailAddress: EmailAddressCodec,
  purpose: t.literal('VerifyEmailToken')
});

type VerifyEmailTokenPayload = t.TypeOf<typeof VerifyEmailTokenPayload>;

export const createEmailVerificationLink =
  (conf: Config) => (user: User) =>
    pipe(
      {
        ...user,
        purpose: 'VerifyEmailToken',
      },
      createSignedToken<VerifyEmailTokenPayload>(conf, '24h'),
      token => `${conf.PUBLIC_URL}/auth/verify-email/landing?token=${token}`
    );

const EmailVerificationQuery = t.strict({
  token: t.string,
});

export const decodeEmailVerificationLink =
  (logger: Logger, conf: Config) => (req: Request) =>
    // We don't use passport because there is currently only 1 way to encode/decode an email verification link
    // so there is no value in adding further abstraction behind passport.
    pipe(
      req.query,
      logPassThru(logger, 'Attempting to decode email verification link from query'), // Logging is required as a basic form of auth enumeration detection.
      EmailVerificationQuery.decode,
      E.chainW(({token}) => verifyToken(token, conf.TOKEN_SECRET)),
      E.chainW(VerifyEmailTokenPayload.decode)
    );

