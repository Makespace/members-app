import {UUID} from 'io-ts-types';
import {EmailAddress} from '../../types';
import * as O from 'fp-ts/Option';

export type Area = {
  id: UUID;
  name: string;
  owners: number[];
  email: O.Option<EmailAddress>;
};
