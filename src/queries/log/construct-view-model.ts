import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    deps.getAllEvents(),
    TE.map(RA.reverse),
    TE.map(
      events =>
        ({
          events,
          user,
        }) satisfies ViewModel
    )
  );
