import {sequenceS} from 'fp-ts/lib/Apply';
import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {queries} from '../../queries';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    {
      events: deps.getAllEvents(),
      trainers: deps.getTrainers(),
    },
    sequenceS(TE.ApplySeq),
    TE.map(partial => ({
      user,
      trainers: partial.trainers,
      isSuperUser: queries.superUsers.is(user.memberNumber)(partial.events),
    }))
  );
