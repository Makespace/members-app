import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../../types';
import {FailedLinking} from './failed-linking';
import {isEventOfType} from '../../types';

export const getFailedImports = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<FailedLinking> =>
  pipe(
    events,
    RA.filter(
      isEventOfType('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')
    ),
    RA.map(({memberNumber, email}) => ({memberNumber, email}))
  );
