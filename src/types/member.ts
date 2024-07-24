import * as O from 'fp-ts/Option';
import {Newtype, iso} from 'newtype-ts';

export interface GravatarHash
  extends Newtype<{readonly GravatarHash: unique symbol}, string> {}

export const isoGravatarHash = iso<GravatarHash>();

export type MemberDetails = Member & Details;

export type Member = {
  memberNumber: number;
  emailAddress: string;
};

type Details = {
  name: O.Option<string>;
  pronouns: O.Option<string>;
  isSuperUser: boolean;
  prevEmails: string[];
  gravatarHash: GravatarHash;
};

export type MultipleMemberDetails = Map<number, MemberDetails>;
