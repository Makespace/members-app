import * as O from 'fp-ts/Option';
import {EmailAddress, GravatarHash} from '../../types';

type TrainedOn = {
  id: string;
  trainedAt: Date;
};

export type Member = {
  trainedOn: ReadonlyArray<TrainedOn>;
  memberNumber: number;
  emailAddress: EmailAddress;
  prevEmails: ReadonlyArray<EmailAddress>;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
  isSuperUser: boolean;
  gravatarHash: GravatarHash;
};

export type MultipleMembers = Map<number, Member>;
