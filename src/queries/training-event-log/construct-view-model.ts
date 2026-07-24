import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {FailureWithStatus} from '../../types/failure-with-status';
import {ResolvedMember, ViewModel} from './view-model';
import {mustBeSuperuser} from '../util';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {
  CandidateTrainingQuizCompleted,
  getTrainingQuizCandidates,
} from '../../read-models/external-state/training-quiz-candidates';

export const constructViewModel =
  (sharedReadModel: Dependencies['sharedReadModel'], extDB: ExternalStateDB) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const superUserCheck = await mustBeSuperuser(sharedReadModel, user)();
    if (E.isLeft(superUserCheck)) {
      return superUserCheck;
    }
    // Resolve the row to a known member: by member number first, then by email.
    const resolveMember = (
      candidate: CandidateTrainingQuizCompleted
    ): O.Option<ResolvedMember> =>
      pipe(
        candidate.memberNumber,
        O.chain(sharedReadModel.members.getByMemberNumber),
        O.alt(() =>
          pipe(
            candidate.email,
            O.chain(email => sharedReadModel.members.getByEmail(email, false))
          )
        ),
        O.map(member => ({
          name: member.name,
          memberNumber: member.memberNumber,
          primaryEmailAddress: member.primaryEmailAddress,
        }))
      );

    const sheetToEquipment =
      sharedReadModel.equipment.getTrainingSheetIdMapping();
    const candidates = await getTrainingQuizCandidates(extDB)(sheetToEquipment);
    // Drop rows already imported as events (dedup by hash).
    const imported = sharedReadModel.trainingQuiz.importedRowHashes();
    const pending = candidates.filter(
      candidate => !imported.has(candidate.rowHash)
    );
    return E.right({
      importedCount: candidates.length - pending.length,
      candidates: pending.map(candidate => ({
        equipmentId: candidate.equipmentId,
        equipmentName: pipe(
          sharedReadModel.equipment.get(candidate.equipmentId),
          O.map(equipment => equipment.name),
          O.getOrElse(() => 'Unknown equipment')
        ),
        completedAt: candidate.completedAt,
        email: candidate.email,
        memberNumber: candidate.memberNumber,
        member: resolveMember(candidate),
        score: candidate.score,
        maxScore: candidate.maxScore,
        rowHash: candidate.rowHash,
        // The raw sheet facts the event would store - no resolved member/equipment.
        raw: JSON.stringify(
          {
            sheetId: candidate.sheetId,
            completedAt: candidate.completedAt.toISOString(),
            email: O.toNullable(candidate.email),
            memberNumber: O.toNullable(candidate.memberNumber),
            score: candidate.score,
            maxScore: candidate.maxScore,
            rowHash: candidate.rowHash,
          },
          null,
          2
        ),
      })),
    });
  };
