import {pipe} from 'fp-ts/lib/function';
import {DomainEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';

export const getAll = (events: ReadonlyArray<DomainEvent>) =>
  pipe(
    events,
    RA.filter(isEventOfType('AreaCreated')),
    RA.map(areaCreated => ({...areaCreated, owners: [1234, 2333]}))
  );
