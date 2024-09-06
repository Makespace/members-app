import * as O from 'fp-ts/Option';
import {EmailAddress, GravatarHash} from '../../types';

export type Equipment = {
  id: string;
  name: string;
  trainers: ReadonlyArray<MemberCoreInfo>;
  trainedMembers: ReadonlyArray<MemberCoreInfo>;
  area: {
    id: string;
    name: string;
  };
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

type MemberCoreInfo = {
  memberNumber: number;
  emailAddress: EmailAddress;
  prevEmails: ReadonlyArray<EmailAddress>;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
  isSuperUser: boolean;
  gravatarHash: GravatarHash;
};

export type Member = MemberCoreInfo & {
  trainedOn: ReadonlyArray<TrainedOn>;
  ownerOf: ReadonlyArray<OwnerOf>;
};
