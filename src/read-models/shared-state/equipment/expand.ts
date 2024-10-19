import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq, and, not, max} from 'drizzle-orm';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  membersTable,
  trainedMemberstable,
  trainersTable,
  trainingQuizTable,
} from '../state';
import {
  EpochTimestampMilliseconds,
  FailedQuizAttempt,
  MemberAwaitingTraining,
  MinimalEquipment,
  OrphanedPassedQuiz,
  TrainedMember,
  TrainerInfo,
} from '../return-types';
import {UUID} from 'io-ts-types';
import {accumByMap} from '../../../util';
import {Actor} from '../../../types';
import {getAreaMinimal} from '../area/get';

const expandTrainers =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {trainers: ReadonlyArray<TrainerInfo>} =>
    pipe(
      db
        .select()
        .from(membersTable)
        .innerJoin(
          trainersTable,
          eq(membersTable.memberNumber, trainersTable.memberNumber)
        )
        .where(eq(trainersTable.equipmentId, equipment.id))
        .all(),
      RA.map(member => ({
        ...member.members,
        agreementSigned: O.fromNullable(member.members.agreementSigned),
        markedTrainerByActor: O.fromEither(
          Actor.decode(member.trainers.markedTrainerByActor)
        ),
        trainerSince: member.trainers.since,
      })),
      trainers => ({
        ...equipment,
        trainers,
      })
    );

const expandTrainedMembers =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {trainedMembers: ReadonlyArray<TrainedMember>} =>
    pipe(
      db
        .select()
        .from(membersTable)
        .innerJoin(
          trainedMemberstable,
          eq(membersTable.memberNumber, trainedMemberstable.memberNumber)
        )
        .where(eq(trainedMemberstable.equipmentId, equipment.id))
        .orderBy(trainedMemberstable.trainedAt)
        .all(),
      accumByMap(
        row => row.members.memberNumber,
        rows => rows[rows.length - 1]
      ),
      RA.map(result => ({
        ...result.members,
        markedTrainedByActor: O.fromEither(
          Actor.decode(result.trainedMembers.trainedByActor)
        ),
        trainedSince: result.trainedMembers.trainedAt,
        agreementSigned: O.fromNullable(result.members.agreementSigned),
      })),
      trainedMembers => ({
        ...equipment,
        trainedMembers,
      })
    );

// Doing all the filtering in the where statements rather than doing a multi-step
// thing where we get all the trained members then get the quiz results and then filter.
// Since the db is local / in memory this should be pretty fast.
const quizPassed = eq(trainingQuizTable.score, trainingQuizTable.maxScore);
const expandMembersAwaitingTraining =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {membersAwaitingTraining: ReadonlyArray<MemberAwaitingTraining>} =>
    pipe(
      db
        .select()
        .from(trainingQuizTable)
        .innerJoin(
          // If member info is null then this is an orphaned result.
          membersTable,
          eq(trainingQuizTable.memberNumberProvided, membersTable.memberNumber)
        )
        .leftJoin(
          trainedMemberstable,
          eq(membersTable.memberNumber, trainedMemberstable.memberNumber)
        )
        .where(and(eq(trainingQuizTable.equipmentId, equipment.id), quizPassed))
        .all(),
      RA.filter(q => q.trainedMembers === null), // Only include members not already trained.
      rows => {
        const latestQuizRowByMember = new Map<number, (typeof rows)[0]>();
        for (const row of rows) {
          const existing = latestQuizRowByMember.get(row.members.memberNumber);
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
      })),
      membersAwaitingTraining => ({
        ...equipment,
        membersAwaitingTraining,
      })
    );

const expandFailedQuizAttempts =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {failedQuizAttempts: ReadonlyArray<FailedQuizAttempt>} =>
    pipe(
      db
        .select()
        .from(trainingQuizTable)
        .innerJoin(
          membersTable,
          eq(trainingQuizTable.memberNumberProvided, membersTable.memberNumber)
        )
        .leftJoin(
          trainedMemberstable,
          eq(membersTable.memberNumber, trainedMemberstable.memberNumber)
        )
        .where(
          and(eq(trainingQuizTable.equipmentId, equipment.id), not(quizPassed))
        )
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
      })),
      failedQuizAttempts => ({
        ...equipment,
        failedQuizAttempts,
      })
    );

const expandOrphanedTrainingQuizes =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {orphanedPassedQuizes: ReadonlyArray<OrphanedPassedQuiz>} => ({
    ...equipment,
    orphanedPassedQuizes: pipe(
      db
        .select()
        .from(trainingQuizTable)
        .leftJoin(
          // If member info is null then this is an orphaned result.
          membersTable,
          eq(trainingQuizTable.memberNumberProvided, membersTable.memberNumber)
        )
        .where(and(eq(trainingQuizTable.equipmentId, equipment.id), quizPassed))
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
    ),
  });

export const expandLastQuizResult =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {lastQuizResult: O.Option<EpochTimestampMilliseconds>} =>
    pipe(
      db
        .select({
          lastQuizResult: max(trainingQuizTable.timestamp),
        })
        .from(trainingQuizTable)
        .where(eq(trainingQuizTable.equipmentId, equipment.id))
        .get(),
      row =>
        O.fromNullable(
          row?.lastQuizResult?.getTime() as EpochTimestampMilliseconds
        ),
      lastQuizResult => ({
        ...equipment,
        lastQuizResult,
      })
    );

export const expandAll =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(equipment: T) => {
    return pipe(
      equipment,
      expandTrainers(db),
      expandTrainedMembers(db),
      expandMembersAwaitingTraining(db),
      expandOrphanedTrainingQuizes(db),
      expandFailedQuizAttempts(db),
      expandLastQuizResult(db),
      e => ({
        ...e,
        area: O.getOrElse(() => ({
          id: e.areaId,
          name: 'unknown',
        }))(getAreaMinimal(db)(e.areaId)),
      })
    );
  };
