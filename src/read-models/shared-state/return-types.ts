import * as O from 'fp-ts/Option';
import {EmailAddress, GravatarHash} from '../../types';

export type Equipment = {
  id: string;
  name: string;
  trainers: ReadonlyArray<Member>;
  trainedMembers: ReadonlyArray<Member>;
};

type TrainedOn = {
  id: string;
  name: string;
  trainedAt: Date;
};

type OwnerOf = {
  id: string;
  name: string;
  ownershipRecordedAt: Date;
};

export type Member = {
  trainedOn: ReadonlyArray<TrainedOn>;
  ownerOf: ReadonlyArray<OwnerOf>;
  memberNumber: number;
  emailAddress: EmailAddress;
  prevEmails: ReadonlyArray<EmailAddress>;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
  isSuperUser: boolean;
  gravatarHash: GravatarHash;
};
