import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, and, not, max} from 'drizzle-orm';
import {SharedReadModel} from '.';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  areasTable,
  equipmentTable,
  membersTable,
  trainedMemberstable,
  trainersTable,
  trainingQuizTable,
} from './state';
import {EpochTimestampMilliseconds} from './return-types';
import {UUID} from 'io-ts-types';
import {accumByMap} from '../../util';

export const getEquipment =
  (db: BetterSQLite3Database): SharedReadModel['equipment']['get'] =>
  (id: UUID) => {
    const getArea = (areaId: string) =>
      pipe(
        db.select().from(areasTable).where(eq(areasTable.id, areaId)).get(),
        O.fromNullable
      );

    const getTrainers = () =>
      pipe(
        db
          .select()
          .from(membersTable)
          .leftJoin(
            trainersTable,
            eq(membersTable.memberNumber, trainersTable.memberNumber)
          )
          .where(eq(trainersTable.equipmentId, id))
          .all(),
        RA.map(result => result.members),
        RA.map(member => ({
          ...member,
          agreementSigned: O.fromNullable(member.agreementSigned),
        }))
      );

    const quizPassed = eq(trainingQuizTable.score, trainingQuizTable.maxScore);
    const getTrainedMembers = () =>
      pipe(
        db
          .select()
          .from(membersTable)
          .innerJoin(
            trainedMemberstable,
            eq(membersTable.memberNumber, trainedMemberstable.memberNumber)
          )
          .where(eq(trainedMemberstable.equipmentId, id))
          .orderBy(trainedMemberstable.trainedAt)
          .all(),
        accumByMap(
          row => row.members.memberNumber,
          rows => rows[rows.length - 1]
        ),
        RA.map(result => ({
          ...result.members,
          trainedBy: result.trainedMembers.trainedBy,
          trainedAt: result.trainedMembers.trainedAt,
          agreementSigned: O.fromNullable(result.members.agreementSigned),
        }))
      );

    // Doing all the filtering in the where statements rather than doing a multi-step
    // thing where we get all the trained members then get the quiz results and then filter.
    // Since the db is local / in memory this should be pretty fast.
    const getMembersAwaitingTraining = () =>
      pipe(
        db
          .select()
          .from(trainingQuizTable)
          .innerJoin(
            // If member info is null then this is an orphaned result.
            membersTable,
            eq(
              trainingQuizTable.memberNumberProvided,
              membersTable.memberNumber
            )
          )
          .leftJoin(
            trainedMemberstable,
            eq(membersTable.memberNumber, trainedMemberstable.memberNumber)
          )
          .where(and(eq(trainingQuizTable.equipmentId, id), quizPassed))
          .all(),
        RA.filter(q => q.trainedMembers === null), // Only include members not already trained.
        rows => {
          const latestQuizRowByMember = new Map<number, (typeof rows)[0]>();
          for (const row of rows) {
            const existing = latestQuizRowByMember.get(
              row.members.memberNumber
            );
            if (
              !existing ||
              existing.trainingQuizResults.timestamp <
                row.trainingQuizResults.timestamp
            ) {
              latestQuizRowByMember.set(row.members.memberNumber, row);
            }
          }
          return [...latestQuizRowByMember.values()];
        },
        RA.map(q => ({
          ...q.members,
          quizId: q.trainingQuizResults.quizId as UUID,
          agreementSigned: O.fromNullable(q.members.agreementSigned),
          waitingSince: q.trainingQuizResults.timestamp,
        }))
      );

    const getFailedQuizAttempts = () =>
      pipe(
        db
          .select()
          .from(trainingQuizTable)
          .innerJoin(
            membersTable,
            eq(
              trainingQuizTable.memberNumberProvided,
              membersTable.memberNumber
            )
          )
          .leftJoin(
            trainedMemberstable,
            eq(membersTable.memberNumber, trainedMemberstable.memberNumber)
          )
          .where(and(eq(trainingQuizTable.equipmentId, id), not(quizPassed)))
          .all(),
        RA.filter(q => q.trainedMembers === null), // Only include members not already trained.
        RA.map(q => ({
          ...q.members,
          agreementSigned: O.fromNullable(q.members.agreementSigned),
          quizId: q.trainingQuizResults.quizId as UUID,
          score: q.trainingQuizResults.score,
          maxScore: q.trainingQuizResults.maxScore,
          percentage: Math.ceil(
            (q.trainingQuizResults.score / q.trainingQuizResults.maxScore) * 100
          ),
          timestamp: q.trainingQuizResults.timestamp,
        }))
      );

    const getOrphanedTrainingQuizes = () =>
      pipe(
        db
          .select()
          .from(trainingQuizTable)
          .leftJoin(
            // If member info is null then this is an orphaned result.
            membersTable,
            eq(
              trainingQuizTable.memberNumberProvided,
              membersTable.memberNumber
            )
          )
          .where(and(eq(trainingQuizTable.equipmentId, id), quizPassed))
          .all(),
        RA.filter(q => q.members === null), // Unknown user.
        RA.map(q => ({
          id: q.trainingQuizResults.quizId as UUID,
          score: q.trainingQuizResults.score,
          maxScore: q.trainingQuizResults.maxScore,
          percentage: Math.ceil(
            (q.trainingQuizResults.score / q.trainingQuizResults.maxScore) * 100
          ),
          timestamp: q.trainingQuizResults.timestamp,
          memberNumberProvided: O.fromNullable(
            q.trainingQuizResults.memberNumberProvided
          ),
          emailProvided: O.fromNullable(q.trainingQuizResults.emailProvided),
        }))
      );

    const getLastQuizResult = () =>
      pipe(
        db
          .select({
            lastQuizResult: max(trainingQuizTable.timestamp),
          })
          .from(trainingQuizTable)
          .where(eq(trainingQuizTable.equipmentId, id))
          .get(),
        row => {
          return O.fromNullable(
            row?.lastQuizResult?.getTime() as EpochTimestampMilliseconds
          );
        }
      );

    return pipe(
      db.select().from(equipmentTable).where(eq(equipmentTable.id, id)).get(),
      O.fromNullable,
      O.map(data => ({
        ...data,
        id,
        trainingSheetId: O.fromNullable(data.trainingSheetId),
        lastQuizSync: O.fromNullable(
          data.lastQuizSync
        ) as O.Option<EpochTimestampMilliseconds>,
      })),
      O.let('trainers', getTrainers),
      O.let('trainedMembers', getTrainedMembers),
      O.let('membersAwaitingTraining', getMembersAwaitingTraining),
      O.let('orphanedPassedQuizes', getOrphanedTrainingQuizes),
      O.let('failedQuizAttempts', getFailedQuizAttempts),
      O.let('lastQuizResult', getLastQuizResult),
      O.bind('area', ({areaId}) => getArea(areaId)),
      foo => foo
    );
  };

export const getAllEquipment =
  (db: BetterSQLite3Database): SharedReadModel['equipment']['getAll'] =>
  () =>
    pipe(
      db.select().from(equipmentTable).all(),
      RA.map(e => {
        const opt = getEquipment(db)(e.id as UUID);
        if (O.isNone(opt)) {
          throw new Error('');
        }
        return opt.value;
      })
    );
