import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {readModels} from '../../read-models';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {QuizResultViewModel, ViewModel} from './view-model';
import {MemberDetails, User} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {DomainEvent, EventOfType} from '../../types/domain-event';
import {Equipment} from '../../read-models/equipment/get';
import {AllMemberDetails} from '../../read-models/members/get-all';
import {Logger} from 'pino';
import {getMembersTrainedOn} from '../../read-models/equipment/get-trained-on';
import {DateTime} from 'luxon';

const getEquipment = (
  events: ReadonlyArray<DomainEvent>,
  equipmentId: string
) =>
  pipe(
    equipmentId,
    readModels.equipment.get(events),
    TE.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    )
  );

const indexMembersByEmail = (byId: AllMemberDetails) => {
  return pipe(
    Object.values(byId),
    RA.reduce(
      {} as Record<string, MemberDetails>,
      (acc, member: MemberDetails) => {
        acc[member.email] = member;
        member.prevEmails.forEach(email => (acc[email] = member));
        return acc;
      }
    )
  );
};

const getQuizEvents = (
  events: ReadonlyArray<DomainEvent>,
  equipment: Equipment
) => {
  const results: {
    [
      index: EventOfType<'EquipmentTrainingQuizResult'>['id']
    ]: EventOfType<'EquipmentTrainingQuizResult'>;
  } = {};
  events.forEach(event => {
    // Requires events to be provided in order.
    switch (event.type) {
      case 'EquipmentTrainingQuizResult':
        if (event.equipmentId === equipment.id) {
          results[event.id] = event;
        }
        break;
      case 'EquipmentTrainingQuizEmailUpdated':
        if (results[event.quizId]) {
          results[event.quizId].emailProvided = event.newEmail;
        }
        break;
      case 'EquipmentTrainingQuizMemberNumberUpdated':
        if (results[event.quizId]) {
          results[event.quizId].memberNumberProvided = event.newMemberNumber;
        }
        break;
      default:
        break;
    }
  });
  return Object.values(results);
};

const reduceToLatestQuizResultByMember = (
  logger: Logger,
  members: AllMemberDetails,
  membersByEmail: Record<string, MemberDetails>,
  quizResults: ReturnType<typeof getQuizEvents>
) => {
  const memberQuizResults: Record<number, QuizResultViewModel> = {};
  const unknownMemberQuizResults: QuizResultViewModel[] = [];
  for (const quizResult of quizResults) {
    const memberFoundByNumber = quizResult.memberNumberProvided
      ? members.get(quizResult.memberNumberProvided)
      : undefined;
    const memberFoundByEmail =
      quizResult.emailProvided !== null
        ? membersByEmail[quizResult.emailProvided]
        : undefined;

    if (
      memberFoundByNumber === memberFoundByEmail &&
      memberFoundByNumber !== undefined
    ) {
      const existing = memberQuizResults[memberFoundByNumber.number];
      if (!existing) {
        memberQuizResults[memberFoundByNumber.number] = {
          id: quizResult.id,
          score: quizResult.score,
          maxScore: quizResult.maxScore,
          percentage: quizResult.percentage,
          passed: quizResult.fullMarks,
          timestamp: DateTime.fromSeconds(quizResult.timestampEpochS),
          memberNumber: memberFoundByNumber.number,
          otherAttempts: [],
        };
        continue;
      }
      if (existing.passed) {
        if (quizResult.fullMarks) {
          // Overwrite.
          memberQuizResults[memberFoundByNumber.number] = {
            id: quizResult.id,
            score: quizResult.score,
            maxScore: quizResult.maxScore,
            percentage: quizResult.percentage,
            passed: quizResult.fullMarks,
            timestamp: DateTime.fromSeconds(quizResult.timestampEpochS),
            memberNumber: memberFoundByNumber.number,
            otherAttempts: [existing.id].concat(existing.otherAttempts),
          };
        } else {
          memberQuizResults[memberFoundByNumber.number].otherAttempts =
            memberQuizResults[memberFoundByNumber.number].otherAttempts.concat([
              quizResult.id,
            ]);
        }
      } else {
        memberQuizResults[memberFoundByNumber.number] = {
          id: quizResult.id,
          score: quizResult.score,
          maxScore: quizResult.maxScore,
          percentage: quizResult.percentage,
          passed: quizResult.fullMarks,
          timestamp: DateTime.fromSeconds(quizResult.timestampEpochS),
          memberNumber: memberFoundByNumber.number,
          otherAttempts: [existing.id].concat(existing.otherAttempts),
        };
      }
      continue;
    }
    unknownMemberQuizResults.push({
      id: quizResult.id,
      score: quizResult.score,
      maxScore: quizResult.maxScore,
      percentage: quizResult.percentage,
      passed: quizResult.fullMarks,
      timestamp: DateTime.fromSeconds(quizResult.timestampEpochS),
      memberNumber: memberFoundByNumber!.number,
      otherAttempts: [],
    });
  }
  return {
    memberQuizResults,
    unknownMemberQuizResults,
  };
};

const getQuizResults = (
  logger: Logger,
  events: ReadonlyArray<DomainEvent>,
  equipment: Equipment
): TE.TaskEither<
  FailureWithStatus,
  {
    quizPassedNotTrained: {
      knownMember: ReadonlyArray<QuizResultViewModel>;
      unknownMember: ReadonlyArray<QuizResultViewModel>;
    };
    failedQuizNotTrained: {
      knownMember: ReadonlyArray<QuizResultViewModel>;
    };
  }
> => {
  const members = readModels.members.getAllDetails(events);
  const membersByEmail = indexMembersByEmail(members);
  const quizEvents = getQuizEvents(events, equipment);
  const trainedMembers = getMembersTrainedOn(equipment.id)(events);
  const memberResults = reduceToLatestQuizResultByMember(
    logger,
    members,
    membersByEmail,
    quizEvents
  );

  return TE.right({
    quizPassedNotTrained: {
      knownMember: Object.values(memberResults.memberQuizResults).filter(
        r => r.passed && !trainedMembers.has(r.memberNumber)
      ),
      unknownMember: memberResults.unknownMemberQuizResults.filter(
        r => r.passed
      ),
    },
    failedQuizNotTrained: {
      knownMember: Object.values(memberResults.memberQuizResults).filter(
        r => !r.passed && !trainedMembers.has(r.memberNumber)
      ),
    },
  });
};

const isSuperUserOrOwnerOfArea = (
  events: ReadonlyArray<DomainEvent>,
  areaId: string,
  memberNumber: number
) =>
  TE.right(
    readModels.superUsers.is(memberNumber)(events) ||
      readModels.areas.isOwner(events)(areaId, memberNumber)
  );

const isSuperUserOrTrainerOfEquipment = (
  events: ReadonlyArray<DomainEvent>,
  equipment: Equipment,
  memberNumber: number
) =>
  TE.right(
    readModels.superUsers.is(memberNumber)(events) ||
      equipment.trainers.includes(memberNumber)
  );

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: string): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      {user},
      TE.right,
      TE.bind('events', () => deps.getAllEvents()),
      TE.bind('equipment', ({events}) => getEquipment(events, equipmentId)),
      TE.bindW('isSuperUserOrOwnerOfArea', ({events, equipment}) =>
        isSuperUserOrOwnerOfArea(events, equipment.areaId, user.memberNumber)
      ),
      TE.bindW('isSuperUserOrTrainerOfArea', ({events, equipment}) =>
        isSuperUserOrTrainerOfEquipment(events, equipment, user.memberNumber)
      ),
      TE.bindW('trainingQuizResults', ({events, equipment}) =>
        getQuizResults(deps.logger, events, equipment)
      )
    );
