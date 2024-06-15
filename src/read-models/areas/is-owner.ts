/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {DomainEvent} from '../../types';

export const isOwner =
  (events: ReadonlyArray<DomainEvent>) =>
  (areaId: string, memberNumber: number): boolean =>
    true;
