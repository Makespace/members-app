import {pipe} from 'fp-ts/lib/function';
import {DomainEvent} from '../../types';
import {constructReadModel} from './construct-read-model';

export const is =
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>): boolean =>
    pipe(
      events,
      constructReadModel,
      superUsers => Array.from(superUsers.keys()),
      keys => keys.includes(memberNumber)
    );
