import {Request, Response} from 'express';
import {Config} from '../../configuration';
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';

const DeclareSuperUserCommand = t.strict({
  memberNumber: tt.NumberFromString,
});

export const declareSuperUser =
  (conf: Config) => (req: Request, res: Response) => {
    if (req.headers.authorization !== `Bearer ${conf.ADMIN_API_BEARER_TOKEN}`) {
      res.status(401).send('Unauthorized\n');
    } else {
      pipe(
        req.body,
        DeclareSuperUserCommand.decode,
        E.mapLeft(formatValidationErrors),
        E.match(
          errors => res.status(400).send({message: 'Bad request', errors}),
          () => res.status(501).send('not implemented')
        )
      );
    }
  };
