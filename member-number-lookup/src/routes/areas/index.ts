import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {failure} from '../../types';
import {Dependencies} from '../../dependencies';
import {render} from './render';
import {getUserFromSession} from '../../authentication';
import {constructViewModel} from './construct-view-model';
import {logInRoute} from '../../authentication/configure-auth-routes';

export const areas =
  (deps: Dependencies) => async (req: Request, res: Response) => {
    await pipe(
      req.session,
      getUserFromSession(deps),
      TE.fromOption(() => failure('You are not logged in.')()),
      TE.chain(constructViewModel(deps)),
      TE.map(render),
      TE.matchW(
        () => res.redirect(logInRoute),
        page => res.status(200).send(page)
      )
    )();
  };
