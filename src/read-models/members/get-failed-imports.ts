import {pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../../types';
import {replayState} from '../shared-state';
import {FailedLinking} from './failed-linking';

export const getFailedImports = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<FailedLinking> =>
  pipe(
    events,
    replayState,
    state => state.failedImports,
    failedImports => Array.from(failedImports.values())
  );
