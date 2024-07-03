/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {DomainEvent} from '../../types';

type FailedLinking = {
  memberNumber: number;
  email: string;
};

export const getFailedImports = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<FailedLinking> => [];
