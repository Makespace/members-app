import * as O from 'fp-ts/Option';

export type MemberDetails = RequiredMemberDetails & OptionalMemberDetails;

export type RequiredMemberDetails = {
  email: string;
  memberNumber: number;
};

export type OptionalMemberDetails = {
  name: O.Option<string>;
  pronouns: O.Option<string>;
};
