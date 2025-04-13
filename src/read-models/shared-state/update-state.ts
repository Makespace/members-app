import {DomainEvent} from '../../types/domain-event';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../members/avatar';
import {
  areasTable,
  equipmentTable,
  memberLinkTable,
  membersTable,
  ownersTable,
  trainedMemberstable,
  trainersTable,
  trainingQuizTable,
  troubleTicketResponsesTable,
} from './state';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {and, eq, inArray} from 'drizzle-orm';
import {isOwnerOfAreaContainingEquipment} from './area/helpers';
import {pipe} from 'fp-ts/lib/function';

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
            formOfAddress: O.none,
            prevEmails: [],
            isSuperUser: false,
            agreementSigned: undefined,
            superUserSince: undefined,
            status: 'inactive',
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
        if (event.formOfAddress) {
          db.update(membersTable)
            .set({formOfAddress: O.some(event.formOfAddress)})
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
          .set({isSuperUser: true, superUserSince: event.recordedAt})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
        break;
      case 'SuperUserRevoked':
        db.update(membersTable)
          .set({isSuperUser: false, superUserSince: null})
          .where(eq(membersTable.memberNumber, event.memberNumber))
          .run();
        break;
      case 'EquipmentAdded':
        db.insert(equipmentTable)
          .values({id: event.id, name: event.name, areaId: event.areaId})
          .run();
        break;
      case 'TrainerAdded': {
        if (
          isOwnerOfAreaContainingEquipment(db)(
            event.equipmentId,
            event.memberNumber
          )
        ) {
          db.insert(trainersTable)
            .values({
              memberNumber: event.memberNumber,
              equipmentId: event.equipmentId,
              since: event.recordedAt,
              markedTrainerByActor: event.actor,
            })
            .run();
        }
        break;
      }
      case 'MemberTrainedOnEquipment': {
        const existing = O.fromNullable(
          db
            .select()
            .from(trainedMemberstable)
            .where(
              and(
                eq(trainedMemberstable.equipmentId, event.equipmentId),
                eq(trainedMemberstable.memberNumber, event.memberNumber)
              )
            )
            .limit(1)
            .get()
        );
        // A bug was previously found here because the trainedAt value from the database
        // truncates the milliseconds in the date. This leads to 2 completely duplicate events
        // appearing different because the times are different (by < 1000 milliseconds). To prevent
        // this we decrease the trainedAt time value by 1000ms. This does mean 2 non-duplicate events
        // within 1s of each other won't progress further but that doesn't matter for the use-case and
        // the information to resolve is lost by the db milliseconds truncation anyway.
        if (
          O.isSome(existing) &&
          existing.value.trainedAt.getTime() - 1000 < event.recordedAt.getTime()
        ) {
          // If we have already marked this member as trained in the past then
          // don't re-mark them as this would refresh their 'trained since'.
          break;
        }
        if (O.isSome(existing)) {
          db.update(trainedMemberstable)
            .set({
              trainedAt: event.recordedAt,
              trainedByMemberNumber: event.trainedByMemberNumber,
              legacyImport: event.legacyImport,
              markTrainedByActor: event.actor,
            })
            .where(
              and(
                eq(trainedMemberstable.equipmentId, event.equipmentId),
                eq(trainedMemberstable.memberNumber, event.memberNumber)
              )
            )
            .run();
        } else {
          db.insert(trainedMemberstable)
            .values({
              memberNumber: event.memberNumber,
              equipmentId: event.equipmentId,
              trainedAt: event.recordedAt,
              trainedByMemberNumber: event.trainedByMemberNumber,
              legacyImport: event.legacyImport,
              markTrainedByActor: event.actor,
            })
            .run();
        }
        break;
      }
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
            markedOwnerByActor: event.actor,
          })
          .run();
        break;
      case 'OwnerRemoved': {
        db.delete(ownersTable)
          .where(
            and(
              eq(ownersTable.memberNumber, event.memberNumber),
              eq(ownersTable.areaId, event.areaId)
            )
          )
          .run();
        const equipmentInArea = pipe(
          db
            .select({equipmentId: equipmentTable.id})
            .from(equipmentTable)
            .where(eq(equipmentTable.areaId, event.areaId))
            .all(),
          RA.map(({equipmentId}) => equipmentId)
        );
        db.delete(trainersTable)
          .where(
            and(
              inArray(trainersTable.equipmentId, [...equipmentInArea]),
              eq(trainersTable.memberNumber, event.memberNumber)
            )
          )
          .run();
        break;
      }
      case 'EquipmentTrainingQuizResult':
        db.insert(trainingQuizTable)
          .values({
            quizId: event.id,
            equipmentId: event.equipmentId,
            sheetId: event.trainingSheetId,
            memberNumberProvided: event.memberNumberProvided,
            emailProvided: event.emailProvided,
            score: event.score,
            maxScore: event.maxScore,
            timestamp: new Date(event.timestampEpochMS),
          })
          .onConflictDoNothing({
            target: [
              trainingQuizTable.equipmentId,
              trainingQuizTable.sheetId,
              trainingQuizTable.memberNumberProvided,
              trainingQuizTable.emailProvided,
              trainingQuizTable.timestamp,
            ],
          })
          .run();
        break;
      case 'EquipmentTrainingQuizEmailUpdated':
        db.update(trainingQuizTable)
          .set({emailProvided: event.newEmail})
          .where(eq(trainingQuizTable.quizId, event.quizId))
          .run();
        break;
      case 'EquipmentTrainingQuizMemberNumberUpdated':
        db.update(trainingQuizTable)
          .set({memberNumberProvided: event.newMemberNumber})
          .where(eq(trainingQuizTable.quizId, event.quizId))
          .run();
        break;
      case 'EquipmentTrainingSheetRegistered':
        db.update(equipmentTable)
          .set({trainingSheetId: event.trainingSheetId})
          .where(eq(equipmentTable.id, event.equipmentId))
          .run();
        break;
      case 'EquipmentTrainingQuizSync':
        db.update(equipmentTable)
          .set({
            lastQuizSync: event.recordedAt.getTime(),
          })
          .where(eq(equipmentTable.id, event.equipmentId))
          .run();
        break;
      case 'RevokeTrainedOnEquipment':
        db.delete(trainedMemberstable)
          .where(
            and(
              eq(trainedMemberstable.equipmentId, event.equipmentId),
              eq(trainedMemberstable.memberNumber, event.memberNumber)
            )
          )
          .run();
        break;
      case 'TroubleTicketResponseSubmitted':
        db.insert(troubleTicketResponsesTable)
          .values({
            responseSubmitted: new Date(event.response_submitted_epoch_ms),
            emailAddress: event.email_address,
            whichEquipment: event.which_equipment,
            submitterName: event.submitter_name,
            submitterMembershipNumber: event.submitter_membership_number,
            submittedResponse: event.submitted_response,
          })
          .onConflictDoNothing({
            target: [
              troubleTicketResponsesTable.responseSubmitted,
              troubleTicketResponsesTable.emailAddress,
              troubleTicketResponsesTable.whichEquipment,
            ],
          })
          .run();
        break;
      case 'RecurlySubscriptionUpdated': {
        const status = event.hasActiveSubscription ? 'active' : 'inactive';
        db.update(membersTable)
          .set({
            status,
          })
          .where(eq(membersTable.emailAddress, event.email))
          .run();
        break;
      }
      case 'MemberRejoinedWithNewNumber': {
        db.insert(memberLinkTable)
          .values({
            oldMembershipNumber: event.oldMembershipNumber,
            newMembershipNumber: event.newMembershipNumber,
            accountsLinkedAt: event.recordedAt,
            markedLinkedByMemberNumber:
              event.actor.tag === 'user' ? event.actor.user.memberNumber : null,
          })
          .run();
        break;
      }
      default:
        break;
    }
  };
