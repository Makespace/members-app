import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {AreaGroup, ResolvedMember, ViewModel} from './view-model';
import {mustBeSuperuser} from '../util';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {
  CandidateTrainingQuizCompleted,
  getTrainingQuizCandidates,
} from '../../read-models/external-state/training-quiz-candidates';

// The picker only offers machines that have a training sheet - those are the
// only ones that can have candidate quiz rows. Grouped by area, sorted by name.
const buildPicker = (
  sharedReadModel: Dependencies['sharedReadModel']
): ReadonlyArray<AreaGroup> => {
  const byArea = new Map<string, AreaGroup>();
  for (const equipment of sharedReadModel.equipment.getAll()) {
    if (O.isNone(equipment.trainingSheetId)) {
      continue;
    }
    const group = byArea.get(equipment.area.id) ?? {
      areaName: equipment.area.name,
      equipment: [],
    };
    byArea.set(equipment.area.id, {
      ...group,
      equipment: [...group.equipment, {id: equipment.id, name: equipment.name}],
    });
  }
  return [...byArea.values()]
    .map(group => ({
      ...group,
      equipment: [...group.equipment].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }))
    .sort((a, b) => a.areaName.localeCompare(b.areaName));
};

export const constructViewModel =
  (
    sharedReadModel: Dependencies['sharedReadModel'],
    extDB: ExternalStateDB,
    selectedEquipment: O.Option<UUID>
  ) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const superUserCheck = await mustBeSuperuser(sharedReadModel, user)();
    if (E.isLeft(superUserCheck)) {
      return superUserCheck;
    }

    // No machine chosen: show the picker only - no candidate computation.
    if (O.isNone(selectedEquipment)) {
      return E.right({_tag: 'picker', areas: buildPicker(sharedReadModel)});
    }

    const equipment = sharedReadModel.equipment.get(selectedEquipment.value);
    if (O.isNone(equipment)) {
      return E.left(
        failureWithStatus('Equipment not found', StatusCodes.NOT_FOUND)()
      );
    }

    // Resolving a member runs several DB queries (full member expansion), and
    // the same member recurs across many rows (retakes), so memoise per request.
    // Rows resolve by member number, else by email, so cache under whichever
    // identity is used. The email is kept verbatim: getByEmail treats the local
    // part as case-significant, so lowercasing here could merge distinct members.
    const cacheKey = (candidate: CandidateTrainingQuizCompleted): string =>
      O.isSome(candidate.memberNumber)
        ? `n:${candidate.memberNumber.value}`
        : O.isSome(candidate.email)
          ? `e:${candidate.email.value}`
          : 'none';

    const memberCache = new Map<string, O.Option<ResolvedMember>>();
    // Resolve the row to a known member: by member number first, then by email.
    const resolveMember = (
      candidate: CandidateTrainingQuizCompleted
    ): O.Option<ResolvedMember> => {
      const key = cacheKey(candidate);
      const cached = memberCache.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const resolved = pipe(
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
      memberCache.set(key, resolved);
      return resolved;
    };

    // Read candidates for this one machine's sheet only, so the query never
    // scans the whole quiz history. A machine reached directly by URL may have
    // no sheet, in which case there are simply no candidates.
    const sheetId = equipment.value.trainingSheetId;
    const candidates = O.isSome(sheetId)
      ? await getTrainingQuizCandidates(extDB)({
          [sheetId.value]: selectedEquipment.value,
        })
      : [];

    // Drop rows already imported as events (dedup by hash).
    const imported = sharedReadModel.trainingQuiz.importedRowHashes();
    const pending = candidates.filter(
      candidate => !imported.has(candidate.rowHash)
    );
    return E.right({
      _tag: 'selected',
      equipmentName: equipment.value.name,
      importedCount: candidates.length - pending.length,
      candidates: pending.map(candidate => ({
        equipmentId: candidate.equipmentId,
        equipmentName: equipment.value.name,
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
