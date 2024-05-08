/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as O from 'fp-ts/Option';
import {DomainEvent} from '../../types';

export const lookupByEmail =
  (email: string) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<number> =>
    O.none;
