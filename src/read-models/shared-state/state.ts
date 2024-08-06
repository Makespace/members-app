import {sql} from 'drizzle-orm';
import {EmailAddress, GravatarHash} from '../../types';
import * as O from 'fp-ts/Option';
import {blob, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';

type TrainedOn = {
  id: Equipment['id'];
  trainedAt: Date;
};

export const membersTable = sqliteTable('members', {
  memberNumber: integer('memberNumber').notNull(),
  emailAddress: text('emailAddress').notNull().$type<EmailAddress>(),
  gravatarHash: text('gravatarHash').notNull().$type<GravatarHash>(),
  name: blob('name', {mode: 'json'}).notNull().$type<O.Option<string>>(),
  pronouns: blob('pronouns', {mode: 'json'})
    .notNull()
    .$type<O.Option<string>>(),
  prevEmails: blob('prevEmails', {mode: 'json'})
    .notNull()
    .$type<ReadonlyArray<EmailAddress>>(),
  isSuperUser: integer('isSuperUser', {mode: 'boolean'}).notNull(),
});

const createMembersTable = sql`
  CREATE TABLE members (
    memberNumber INTEGER,
    emailAddress TEXT,
    gravatarHash TEXT,
    name BLOB,
    pronouns BLOB,
    prevEmails BLOB,
    isSuperUser INTEGER
  );`;

export const equipmentTable = sqliteTable('equipment', {
  id: text('id').notNull(),
  name: text('id').notNull(),
});

const createEquipmentTable = sql`
  CREATE TABLE equipment (
  id TEXT,
  name TEXT
  );
`;

export const createTables = [createMembersTable, createEquipmentTable];

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
