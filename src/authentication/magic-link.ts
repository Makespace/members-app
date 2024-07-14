import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {failure} from '../types';
import {Strategy as CustomStrategy} from 'passport-custom';
import jwt from 'jsonwebtoken';
import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {User} from '../types/user';
import {logPassThru} from '../util';
import {Logger} from 'pino';

const createMagicLink = (conf: Config) => (user: User) =>
  pipe(
    jwt.sign(user, conf.TOKEN_SECRET, {expiresIn: '10m'}),
    token => `${conf.PUBLIC_URL}/auth/callback?token=${token}`
  );

const MagicLinkQuery = t.strict({
  token: t.string,
});

const verifyToken = (token: string, secret: Config['TOKEN_SECRET']) =>
  E.tryCatch(
    () => jwt.verify(token, secret),
    failure('Could not verify token')
  );

const decodeMagicLinkFromQuery =
  (logger: Logger, conf: Config) => (input: unknown) =>
    pipe(
      input,
      logPassThru(logger, 'Attempting to decode magic link from query'), // Logging is required as a basic form of auth enumeration detection.
      MagicLinkQuery.decode,
      E.chainW(({token}) => verifyToken(token, conf.TOKEN_SECRET)),
      E.chainW(User.decode)
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
