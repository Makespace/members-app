import * as O from 'fp-ts/Option';
import {Newtype, iso} from 'newtype-ts';

export interface GravatarHash
  extends Newtype<{readonly GravatarHash: unique symbol}, string> {}

export const isoGravatarHash = iso<GravatarHash>();

/** @deprecated use Member type from readmodel instead */
export type MemberDetails = Member & Details;

/** @deprecated use User type instead */
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
