import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {Config} from '../../configuration';
import {EmailAddressCodec} from '../../types';
import {Logger} from 'pino';
import { createSignedToken } from '../create-signed-token';

const VerifyEmailTokenPayload = t.strict({
  memberNumber: t.number,
  emailAddress: EmailAddressCodec,
});

type VerifyEmailTokenPayload = t.TypeOf<typeof VerifyEmailTokenPayload>;

const createEmailVerificationLink =
  (conf: Config) => (payload: VerifyEmailTokenPayload) =>
    pipe(
      VerifyEmailTokenPayload.encode(payload),
      createSignedToken(conf),
      token => `${conf.PUBLIC_URL}/auth/verify-email/landing?token=${token}`
    );

const decodeEmailVerificationFromQuery =
  (logger: Logger, conf: Config) => (input: unknown) =>
    pipe(
      input,
      decodeTokenFromQuery(logger, conf),
      E.chainW(VerifyEmailTokenPayload.decode)
    );

export const emailVerificationLink = {
  create: createEmailVerificationLink,
  decodeFromQuery: decodeEmailVerificationFromQuery,
};

