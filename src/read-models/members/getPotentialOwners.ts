import * as O from 'fp-ts/Option';
import {Email} from '../../types';

type Member = {
  number: number;
  email: Email;
  name: O.Option<string>;
  pronouns: O.Option<string>;
};

type PotentialOwner = Member & {
  agreementSigned: O.Option<Date>;
};

type AreaOwners = {
  existing: ReadonlyArray<Member>;
  potential: ReadonlyArray<PotentialOwner>;
};

export const getPotentialOwners = (): AreaOwners => ({
  existing: [],
  potential: [],
});
