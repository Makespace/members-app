import * as O from 'fp-ts/Option';
import {EmailAddress} from '../../types';

export type Member = {
  memberNumber: number;
  emailAddress: EmailAddress;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
};
