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
import {getMemberCore, getMergedMemberSet} from '../member/get';
import {MemberLinking} from '../member-linking';

const expandTrainers =
  (db: BetterSQLite3Database, linking: MemberLinking) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {trainers: ReadonlyArray<TrainerInfo>} =>
    pipe(
      db
        .select({
          memberNumber: trainersTable.memberNumber,
          trainerSince: trainersTable.since,
          markedTrainerByActor: trainersTable.markedTrainerByActor,
        })
        .from(trainersTable)
        .where(eq(trainersTable.equipmentId, equipment.id))
        .all(),
      RA.filterMap(trainer =>
        pipe(
          linking.map(trainer.memberNumber),
          getMergedMemberSet(db),
          O.map(member => ({
            ...member,
            ...trainer,
            markedTrainerByActor: O.fromEither(
              Actor.decode(trainer.markedTrainerByActor)
            ),
          }))
        )
      ),
      trainers => ({
        trainers,
        ...equipment,
      })
    );

const expandTrainedMembers =
  (db: BetterSQLite3Database) =>
  <T extends MinimalEquipment>(
    equipment: T
  ): T & {trainedMembers: ReadonlyArray<TrainedMember>} =>
    pipe(
      db
        .select({
          memberNumber: trainedMemberstable.memberNumber,
        })
        .from(trainedMemberstable)
        .where(eq(trainedMemberstable.equipmentId, equipment.id))
        .orderBy(trainedMemberstable.trainedAt)
        .all(),
      accumByMap(
        row => row.members.memberNumber,
        rows => rows[rows.length - 1]
      ),
      RA.map(result => {
        const trainedByMemberNumber = O.fromNullable(
          result.trainedMembers.trainedByMemberNumber
        );
        return {
          ...result.members,
          markedTrainedByActor: O.fromEither(
            Actor.decode(result.trainedMembers.markTrainedByActor)
          ),
          trainedSince: result.trainedMembers.trainedAt,
          agreementSigned: O.fromNullable(result.members.agreementSigned),
          superUserSince: O.fromNullable(result.members.superUserSince),
          trainedByMemberNumber,
          trainedByEmail: pipe(
            trainedByMemberNumber,
            O.map(getMemberCore(db)),
            O.flatten,
            O.map(trainedByDetails => trainedByDetails.emailAddress)
          ),
          legacyImport: result.trainedMembers.legacyImport,
        };
      }),
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
  ): T & {
    membersAwaitingTraining: ReadonlyArray<MemberAwaitingTraining>;
  } => {
    if (O.isNone(equipment.trainingSheetId)) {
      return {
        ...equipment,
        membersAwaitingTraining: [],
        trainingQuizResultsRaw: [],
      };
    }
    return pipe(
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
          and(
            eq(membersTable.memberNumber, trainedMemberstable.memberNumber),
            eq(trainedMemberstable.equipmentId, equipment.id)
          )
        )
        .where(
          and(
            and(eq(trainingQuizTable.equipmentId, equipment.id), quizPassed),
            eq(trainingQuizTable.sheetId, equipment.trainingSheetId.value)
          )
        )
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
        superUserSince: O.fromNullable(q.members.superUserSince),
        waitingSince: q.trainingQuizResults.timestamp,
      })),
      membersAwaitingTraining => ({
        ...equipment,
        membersAwaitingTraining,
      })
    );
  };

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
          and(
            eq(membersTable.memberNumber, trainedMemberstable.memberNumber),
            eq(trainedMemberstable.equipmentId, equipment.id)
          )
        )
        .where(
          and(eq(trainingQuizTable.equipmentId, equipment.id), not(quizPassed))
        )
        .all(),
      RA.filter(q => q.trainedMembers === null), // Only include members not already trained.
      RA.map(q => ({
        ...q.members,
        agreementSigned: O.fromNullable(q.members.agreementSigned),
        superUserSince: O.fromNullable(q.members.superUserSince),
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

const expandLastQuizResult =
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
