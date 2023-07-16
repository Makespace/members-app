import {sequenceS} from 'fp-ts/lib/Apply';
import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    {
      user: TE.right(user),
      trainers: deps.getTrainers(),
      isSuperUser: TE.right(false),
    },
    sequenceS(TE.ApplySeq)
  );
