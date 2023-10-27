import {pipe} from 'fp-ts/lib/function';
import {User, isEventOfType} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {queries} from '../../queries';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    deps.getAllEvents(),
    TE.map(events => ({
      user: user,
      isSuperUser: queries.superUsers.is(user.memberNumber)(events),
      areas: pipe(events, RA.filter(isEventOfType('AreaCreated'))),
    }))
  );
