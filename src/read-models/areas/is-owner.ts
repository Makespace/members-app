import {pipe} from 'fp-ts/lib/function';
import {DomainEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';

export const isOwner =
  (events: ReadonlyArray<DomainEvent>) =>
  (areaId: string, memberNumber: number): boolean =>
    pipe(
      events,
      RA.filter(isEventOfType('OwnerAdded')),
      RA.some(
        event => event.areaId === areaId && event.memberNumber === memberNumber
      )
    );
