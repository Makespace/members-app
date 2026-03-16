import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {failure} from '../types';
import {Strategy as CustomStrategy} from 'passport-custom';
import jwt from 'jsonwebtoken';
import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {EmailAddressCodec} from '../types';
import {User} from '../types/user';
import {logPassThru} from '../util';
import {Logger} from 'pino';

const LoginTokenPayload = t.strict({
  purpose: t.literal('log-in'),
  user: User,
});

const VerifyEmailTokenPayload = t.strict({
  purpose: t.literal('verify-email'),
  memberNumber: t.number,
  emailAddress: EmailAddressCodec,
});

type VerifyEmailTokenPayload = t.TypeOf<typeof VerifyEmailTokenPayload>;

const createSignedToken =
  (conf: Config) =>
  (payload: object): string =>
    jwt.sign(payload, conf.TOKEN_SECRET, {expiresIn: '10m'});

const createMagicLink = (conf: Config) => (user: User) =>
  pipe(
    LoginTokenPayload.encode({purpose: 'log-in', user}),
    createSignedToken(conf),
    token => `${conf.PUBLIC_URL}/auth/landing?token=${token}`
  );

const createEmailVerificationLink =
  (conf: Config) => (payload: VerifyEmailTokenPayload) =>
    pipe(
      VerifyEmailTokenPayload.encode(payload),
      createSignedToken(conf),
      token => `${conf.PUBLIC_URL}/auth/verify-email/landing?token=${token}`
    );

const MagicLinkQuery = t.strict({
  token: t.string,
});

const verifyToken = (token: string, secret: Config['TOKEN_SECRET']) =>
  E.tryCatch(
    () => jwt.verify(token, secret),
    failure('Could not verify token')
  );

const decodeTokenFromQuery =
  (logger: Logger, conf: Config) => (input: unknown) =>
    pipe(
      input,
      logPassThru(logger, 'Attempting to decode magic link from query'), // Logging is required as a basic form of auth enumeration detection.
      MagicLinkQuery.decode,
      E.chainW(({token}) => verifyToken(token, conf.TOKEN_SECRET))
    );

const decodeMagicLinkFromQuery =
  (logger: Logger, conf: Config) => (input: unknown) =>
    pipe(
      input,
      decodeTokenFromQuery(logger, conf),
      E.chainW(LoginTokenPayload.decode),
      E.map(payload => payload.user)
    );

const decodeEmailVerificationFromQuery =
  (logger: Logger, conf: Config) => (input: unknown) =>
    pipe(
      input,
      decodeTokenFromQuery(logger, conf),
      E.chainW(VerifyEmailTokenPayload.decode)
    );

const strategy = (deps: Dependencies, conf: Config) => {
  return new CustomStrategy((req, done) => {
    pipe(
      req.query,
      decodeMagicLinkFromQuery(deps.logger, conf),
      E.match(
        error => {
          deps.logger.info(
            {error},
            'Failed to authenticate user from magic link'
          );
          done(undefined, false);
        },
        user => done(undefined, user)
      )
    );
  });
};

export const magicLink = {
  name: 'magiclink',
  strategy,
  create: createMagicLink,
};

export const emailVerificationLink = {
  create: createEmailVerificationLink,
  decodeFromQuery: decodeEmailVerificationFromQuery,
};
