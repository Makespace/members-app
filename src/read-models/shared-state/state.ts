import {EmailAddress, GravatarHash} from '../../types';
import * as O from 'fp-ts/Option';

type TrainedOn = {
  id: Equipment['id'];
  trainedAt: Date;
};

type Member = {
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

type Area = {
  id: string;
  owners: Set<number>;
};

type Equipment = {
  id: string;
  name: string;
  areaId: Area['id'];
};

type FailedLinking = {
  memberNumber: number;
  email: string;
};

export type State = {
  members: Map<Member['memberNumber'], Member>;
  areas: Map<Area['id'], Area>;
  equipment: Map<Equipment['id'], Equipment>;
  failedImports: Set<FailedLinking>;
};

export const emptyState = (): State => ({
  members: new Map(),
  areas: new Map(),
  equipment: new Map(),
  failedImports: new Set(),
});
