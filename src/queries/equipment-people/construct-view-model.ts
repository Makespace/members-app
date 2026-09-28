import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Dependencies} from '../../dependencies';
import {User, EmailAddress} from '../../types';
import {FailureWithStatus} from '../../types/failure-with-status';
import {constructViewModel as constructEquipmentViewModel} from '../equipment/construct-view-model';
import {
  MemberAwaitingTraining,
  OrphanedPassedQuiz,
  QuizRow,
} from '../../read-models/external-state/equipment-quiz';
import {SharedReadModel} from '../../read-models/shared-state';

// Everything the lists show about one person, in the shape the shared member
// renderer wants: name, number and address in one cell.
export type PersonSummary = {
  name: O.Option<string>;
  memberNumber: number;
  primaryEmailAddress: O.Option<EmailAddress>;
};

type TrainedPerson = PersonSummary & {
  trainedSince: Date;
  trainedByMemberNumber: O.Option<number>;
};

type WaitingPerson = PersonSummary & {waitingSince: Date};

export type ViewModel = {
  equipment: {id: UUID; name: string};
  // Trainers and owners act on these lists; everyone else may read the
  // trained list only.
  isTrainer: boolean;
  isTrainerOrOwner: boolean;
  trained: ReadonlyArray<TrainedPerson>;
  waiting: ReadonlyArray<WaitingPerson>;
  waitingUnknown: ReadonlyArray<OrphanedPassedQuiz>;
  failed: ReadonlyArray<QuizRow>;
  lastQuizSync: O.Option<Date>;
};

const emailOf = (
  rm: SharedReadModel,
  memberNumber: number
): O.Option<EmailAddress> =>
  pipe(
    rm.members.getByMemberNumber(memberNumber),
    O.map(member => member.primaryEmailAddress)
  );

const toWaiting =
  (rm: SharedReadModel) =>
  (member: MemberAwaitingTraining): WaitingPerson => ({
    name: member.name,
    memberNumber: member.memberNumber,
    primaryEmailAddress: emailOf(rm, member.memberNumber),
    waitingSince: member.waitingSince,
  });

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: UUID): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      constructEquipmentViewModel(deps, user)(equipmentId),
      TE.map(equipmentView => ({
        equipment: {
          id: equipmentView.equipment.id,
          name: equipmentView.equipment.name,
        },
        isTrainer: equipmentView.isSuperUserOrTrainerOfArea,
        isTrainerOrOwner:
          equipmentView.isSuperUserOrTrainerOfArea ||
          equipmentView.isSuperUserOrOwnerOfArea,
        trained: equipmentView.equipment.trainedMembers.map(member => ({
          name: member.name,
          memberNumber: member.memberNumber,
          primaryEmailAddress: O.some(member.primaryEmailAddress),
          trainedSince: member.trainedSince,
          trainedByMemberNumber: member.trainedByMemberNumber,
        })),
        // Most recent pass first: the people a trainer is most likely to be
        // about to hear from, and the ones a glance should find.
        waiting: pipe(
          equipmentView.quizResults,
          O.match(
            () => [],
            results =>
              [...results.membersAwaitingTraining]
                .map(toWaiting(deps.sharedReadModel))
                .sort(
                  (a, b) => b.waitingSince.getTime() - a.waitingSince.getTime()
                )
          )
        ),
        waitingUnknown: pipe(
          equipmentView.quizResults,
          O.match(
            () => [],
            results =>
              [...results.unknownMembersAwaitingTraining].sort(
                (a, b) => b.waitingSince.getTime() - a.waitingSince.getTime()
              )
          )
        ),
        failed: pipe(
          equipmentView.quizResults,
          O.match(
            () => [],
            results =>
              [...results.failedQuizes].sort(
                (a, b) => b.completedAt.getTime() - a.completedAt.getTime()
              )
          )
        ),
        lastQuizSync: pipe(
          equipmentView.quizResults,
          O.chain(results => results.lastQuizSync)
        ),
      }))
    );
