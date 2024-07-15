import * as O from 'fp-ts/Option';

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
};

export type MultipleMemberDetails = Map<number, MemberDetails>;
