import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {FailureWithStatus} from '../../types/failureWithStatus';
import {isEventOfType} from '../../types/domain-event';
import {ViewModel} from './view-model';

export const constructViewModel = (
  deps: Dependencies
): TE.TaskEither<FailureWithStatus, ViewModel> =>
  pipe(
    deps.getAllEvents(),
    TE.map(RA.filter(isEventOfType('MemberNumberLinkedToEmail'))),
    TE.map(members => ({
      members,
    }))
  );
