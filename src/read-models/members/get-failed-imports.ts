import {DomainEvent} from '../../types';

type FailedLinking = {
  memberNumber: number;
  email: string;
};

export const getFailedImports = (
  // eslint-disable-next-line unused-imports/no-unused-vars
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<FailedLinking> => [];
