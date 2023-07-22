import {sequenceS} from 'fp-ts/lib/Apply';
import {pipe} from 'fp-ts/lib/function';
import {User, isEventOfType} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    {
      user: TE.right(user),
      trainers: deps.getTrainers(),
      isSuperUser: pipe(
        deps.getAllEvents(),
        TE.map(RA.filter(isEventOfType('SuperUserDeclared'))),
        TE.map(RA.some(event => event.memberNumber === user.memberNumber))
      ),
      areas: TE.right([
        {
          name: 'Woodshop',
          description: 'A place for wood',
        },
        {
          name: 'Metalshop',
          description: 'A place for metal',
        },
      ]),
    },
    sequenceS(TE.ApplySeq)
  );
