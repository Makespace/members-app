import * as O from 'fp-ts/Option';
import {EmailAddress} from '../../types';

export type Member = {
  number: number;
  email: EmailAddress;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
};
