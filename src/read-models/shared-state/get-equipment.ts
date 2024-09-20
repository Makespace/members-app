import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, isNull, and, isNotNull, not} from 'drizzle-orm';
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
    const alreadyTrained = isNull(trainedMemberstable.memberNumber);
    const isKnownMember = isNotNull(membersTable.memberNumber);
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
          .all(),
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
          .where(
            and(
              and(eq(trainingQuizTable.equipmentId, id), quizPassed),
              not(alreadyTrained)
            )
          )
          .all(),
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
          .where(
            and(
              and(eq(trainingQuizTable.equipmentId, id), not(quizPassed)),
              not(alreadyTrained)
            )
          )
          .all(),
        RA.map(q => ({
          ...q.members,
          agreementSigned: O.fromNullable(q.members.agreementSigned),
          quizId: q.trainingQuizResults.quizId as UUID,
          score: q.trainingQuizResults.score,
          maxScore: q.trainingQuizResults.maxScore,
          percentage: Math.ceil(
            q.trainingQuizResults.score / q.trainingQuizResults.maxScore
          ),
          timestamp: q.trainingQuizResults.timestamp,
          quizAnswers: q.trainingQuizResults.quizAnswers,
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
          .where(
            and(
              and(eq(trainingQuizTable.equipmentId, id), quizPassed),
              not(isKnownMember)
            )
          )
          .all(),
        RA.map(q => ({
          id: q.trainingQuizResults.quizId as UUID,
          score: q.trainingQuizResults.score,
          maxScore: q.trainingQuizResults.maxScore,
          percentage: Math.ceil(
            q.trainingQuizResults.score / q.trainingQuizResults.maxScore
          ),
          timestamp: q.trainingQuizResults.timestamp,
          memberNumberProvided: O.fromNullable(
            q.trainingQuizResults.memberNumberProvided
          ),
          emailProvided: O.fromNullable(q.trainingQuizResults.emailProvided),
        }))
      );

    return pipe(
      db.select().from(equipmentTable).where(eq(equipmentTable.id, id)).get(),
      O.fromNullable,
      O.map(data => ({
        ...data,
        id,
        trainingSheetId: O.fromNullable(data.trainingSheetId),
        lastQuizResult: O.fromNullable(
          data.lastQuizResult
        ) as O.Option<EpochTimestampMilliseconds>,
        lastQuizSync: O.fromNullable(
          data.lastQuizSync
        ) as O.Option<EpochTimestampMilliseconds>,
      })),
      O.let('trainers', getTrainers),
      O.let('trainedMembers', getTrainedMembers),
      O.let('membersAwaitingTraining', getMembersAwaitingTraining),
      O.let('orphanedPassedQuizes', getOrphanedTrainingQuizes),
      O.let('failedQuizAttempts', getFailedQuizAttempts),
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
