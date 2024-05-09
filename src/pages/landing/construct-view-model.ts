import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {queries} from '../../queries';
import {ViewModel} from './view-model';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    deps.getAllEvents(),
    TE.map(
      events =>
        ({
          user,
          isSuperUser: queries.superUsers.is(user.memberNumber)(events),
        }) satisfies ViewModel
    )
  );
