import {DomainEvent} from '../../types/domain-event';
import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../members/avatar';
import {
  areasTable,
  equipmentTable,
  membersTable,
  ownersTable,
  trainedMemberstable,
  trainersTable,
} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';

export const updateState =
  (db: BetterSQLite3Database) => (event: DomainEvent) => {
    switch (event.type) {
      case 'MemberNumberLinkedToEmail':
        db.insert(membersTable)
          .values({
            memberNumber: event.memberNumber,
            emailAddress: event.email,
            gravatarHash: gravatarHashFromEmail(event.email),
            name: O.none,
            pronouns: O.none,
            prevEmails: [],
            isSuperUser: false,
            agreementSigned: undefined,
          })
          .run();
        break;
      case 'MemberDetailsUpdated':
        if (event.name) {
          db.update(membersTable)
            .set({name: O.some(event.name)})
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .run();
        }
        if (event.pronouns) {
          db.update(membersTable)
            .set({pronouns: O.some(event.pronouns)})
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .run();
        }
        break;
      case 'MemberEmailChanged': {
        const current = db
          .select()
          .from(membersTable)
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .get();
        if (current) {
          db.update(membersTable)
            .set({
              emailAddress: event.newEmail,
              prevEmails: [...current.prevEmails, current.emailAddress],
              gravatarHash: gravatarHashFromEmail(event.newEmail),
            })
            .where(eq(membersTable.memberNumber, event.memberNumber))
            .run();
        }
        break;
      }
      case 'SuperUserDeclared':
        db.update(membersTable)
          .set({isSuperUser: true})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
        break;
      case 'SuperUserRevoked':
        db.update(membersTable)
          .set({isSuperUser: false})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
        break;
      case 'EquipmentAdded':
        db.insert(equipmentTable)
          .values({id: event.id, name: event.name})
          .run();
        break;
      case 'TrainerAdded':
        db.insert(trainersTable)
          .values({
            memberNumber: event.memberNumber,
            equipmentId: event.equipmentId,
          })
          .run();
        break;
      case 'MemberTrainedOnEquipment':
        db.insert(trainedMemberstable)
          .values({
            memberNumber: event.memberNumber,
            equipmentId: event.equipmentId,
            trainedAt: event.recordedAt,
          })
          .run();
        break;
      case 'OwnerAgreementSigned':
        db.update(membersTable)
          .set({agreementSigned: event.signedAt})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
        break;
      case 'AreaCreated':
        db.insert(areasTable).values({id: event.id, name: event.name}).run();
        break;
      case 'AreaRemoved':
        db.delete(areasTable).where(eq(areasTable.id, event.id)).run();
        break;
      case 'OwnerAdded':
        db.insert(ownersTable)
          .values({
            memberNumber: event.memberNumber,
            areaId: event.areaId,
            ownershipRecordedAt: event.recordedAt,
          })
          .run();
        break;

      default:
        break;
    }
  };
