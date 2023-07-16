import {Request, Response} from 'express';
import {oopsPage} from '../../shared-pages';
import {pipe} from 'fp-ts/lib/function';
import {sequenceS} from 'fp-ts/lib/Apply';
import * as TE from 'fp-ts/TaskEither';
import {failure} from '../../types';
import {Dependencies} from '../../dependencies';
import {render} from './render';
import {getUserFromSession} from '../../authentication';

export const dashboard =
  (deps: Dependencies) => async (req: Request, res: Response) => {
    await pipe(
      {
        user: pipe(
          req.session,
          getUserFromSession(deps),
          TE.fromOption(() => failure('You are not logged in.')())
        ),
        trainers: deps.getTrainers(),
        isSuperUser: TE.right(false),
      },
      sequenceS(TE.ApplySeq),
      TE.map(render),
      TE.matchW(
        failure => res.status(401).send(oopsPage(failure.message)),
        page => res.status(200).send(page)
      )
    )();
  };
