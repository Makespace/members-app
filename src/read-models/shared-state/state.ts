import {UUID} from 'io-ts-types';
import {EmailAddress, GravatarHash} from '../../types';
import * as O from 'fp-ts/Option';

type TrainedOn = ReadonlyArray<{
  name: string;
  id: UUID;
  trainedAt: Date;
}>;

type Member = {
  trainedOn: TrainedOn;
  memberNumber: number;
  emailAddress: EmailAddress;
  prevEmails: ReadonlyArray<EmailAddress>;
  name: O.Option<string>;
  pronouns: O.Option<string>;
  agreementSigned: O.Option<Date>;
  isSuperUser: boolean;
  gravatarHash: GravatarHash;
};

type Area = {
  id: string;
  owners: Set<number>;
};

type FailedLinking = {
  memberNumber: number;
  email: string;
};

export type State = {
  members: Map<Member['memberNumber'], Member>;
  areas: Map<Area['id'], Area>;
  failedImports: Set<FailedLinking>;
};

export const emptyState = (): State => ({
  members: new Map(),
  areas: new Map(),
  failedImports: new Set(),
});
