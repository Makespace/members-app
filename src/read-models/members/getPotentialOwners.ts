import * as O from 'fp-ts/Option';

type PotentialOwner = {
  number: number;
  email: string;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
};

export const getPotentialOwners = (): ReadonlyArray<PotentialOwner> => [];
