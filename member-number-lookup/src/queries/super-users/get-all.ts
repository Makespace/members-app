/* eslint-disable @typescript-eslint/no-unused-vars */
import {DomainEvent} from '../../types';

export const getAll =
  () =>
  (
    _events: ReadonlyArray<DomainEvent>
  ): ReadonlyArray<{memberNumber: number; since: Date}> => [];
