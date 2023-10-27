import {pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../../types';
import {constructReadModel} from './construct-read-model';

export const getAll =
  () =>
  (
    events: ReadonlyArray<DomainEvent>
  ): ReadonlyArray<{memberNumber: number; since: Date}> =>
    pipe(events, constructReadModel, superUsers =>
      Array.from(superUsers.values())
    );
