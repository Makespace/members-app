import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel} from './view-model';
import {mustBeSuperuser} from '../util';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    mustBeSuperuser(deps.sharedReadModel, user),
    TE.chain(() => deps.getAllEvents()),
    TE.map(events => ({events}) satisfies ViewModel)
  );
