import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {readModels} from '../../read-models';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {
  QuizResultUnknownMemberViewModel,
  QuizResultViewModel,
  ViewModel,
} from './view-model';
import {User} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {DomainEvent, EventOfType} from '../../types/domain-event';
import {Equipment} from '../../read-models/equipment/get';
import {getMembersTrainedOn} from '../../read-models/equipment/get-trained-on';
import {DateTime} from 'luxon';
import {UUID} from 'io-ts-types';
import {Member, MultipleMembers} from '../../read-models/members';

const getEquipment = (events: ReadonlyArray<DomainEvent>, equipmentId: UUID) =>
  pipe(
    equipmentId,
    readModels.equipment.get(events),
    TE.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    )
  );

const indexMembersByEmail = (byId: MultipleMembers) => {
  return pipe(
    Object.values(byId),
    RA.reduce({} as Record<string, Member>, (acc, member: Member) => {
      acc[member.emailAddress] = member;
      member.prevEmails.forEach(email => (acc[email] = member));
      return acc;
    })
  );
};

type QuizResultsMap = {
  [
    index: EventOfType<'EquipmentTrainingQuizResult'>['id']
  ]: EventOfType<'EquipmentTrainingQuizResult'>;
};

const applyQuizResultUpdate =
  (equipment: Equipment) => (results: QuizResultsMap, event: DomainEvent) => {
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
    return results;
  };

const getQuizEvents =
  (equipment: Equipment) =>
  (
    events: ReadonlyArray<DomainEvent>
  ): ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>> =>
    pipe(events, RA.reduce({}, applyQuizResultUpdate(equipment)), results => {
      return Object.values(results);
    });

const updateQuizResults = (
  memberQuizResults: Record<number, QuizResultViewModel>,
  member: Member,
  quizResult: EventOfType<'EquipmentTrainingQuizResult'>
) => {
  const existing = memberQuizResults[member.memberNumber];
  if (quizResult.fullMarks || !existing || !existing.passed) {
    memberQuizResults[member.memberNumber] = {
      id: quizResult.id,
      score: quizResult.score,
      maxScore: quizResult.maxScore,
      percentage: quizResult.percentage,
      passed: quizResult.fullMarks,
      timestamp: DateTime.fromSeconds(quizResult.timestampEpochMS),
      memberNumber: member.memberNumber,
      otherAttempts: existing
        ? [existing.id].concat(existing.otherAttempts)
        : [],
    };
    return;
  }
  existing.otherAttempts = existing.otherAttempts.concat([quizResult.id]);
};

const quizResultsMatch = (
  members: MultipleMembers,
  membersByEmail: Record<string, Member>,
  quizResult: EventOfType<'EquipmentTrainingQuizResult'>
): O.Option<Member> => {
  const memberNumber = O.fromNullable(quizResult.memberNumberProvided);
  const email = O.fromNullable(quizResult.emailProvided);

  const needToMatch: O.Option<Member>[] = [];
  if (O.isSome(memberNumber)) {
    needToMatch.push(O.fromNullable(members.get(memberNumber.value)));
  }
  if (O.isSome(email)) {
    needToMatch.push(O.fromNullable(membersByEmail[email.value]));
  }

  return (needToMatch.length === 1 && O.isSome(needToMatch[0])) ||
    (needToMatch.length === 2 &&
      O.isSome(needToMatch[0]) &&
      needToMatch[0] === needToMatch[1])
    ? needToMatch[0]
    : O.none;
};

const reduceToLatestQuizResultByMember = (
  members: MultipleMembers,
  membersByEmail: Record<string, Member>,
  quizResults: ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>
) =>
  pipe(
    quizResults,
    RA.reduce(
      {
        memberQuizResults: {} as Record<number, QuizResultViewModel>,
        unknownMemberQuizResults: [] as QuizResultUnknownMemberViewModel[],
      },
      (result, quizResult) => {
        const member = quizResultsMatch(members, membersByEmail, quizResult);
        if (O.isSome(member)) {
          updateQuizResults(result.memberQuizResults, member.value, quizResult);
        } else {
          result.unknownMemberQuizResults.push({
            id: quizResult.id,
            score: quizResult.score,
            maxScore: quizResult.maxScore,
            percentage: quizResult.percentage,
            passed: quizResult.fullMarks,
            timestamp: DateTime.fromSeconds(quizResult.timestampEpochMS),
            memberNumberProvided: O.fromNullable(
              quizResult.memberNumberProvided
            ),
            emailProvided: O.fromNullable(quizResult.emailProvided),
          });
        }
        return result;
      }
    )
  );

const getQuizResults = (
  events: ReadonlyArray<DomainEvent>,
  equipment: Equipment,
  deps: Dependencies
): TE.TaskEither<
  FailureWithStatus,
  {
    lastRefresh: O.Option<DateTime>;
    quizPassedNotTrained: {
      knownMember: ReadonlyArray<QuizResultViewModel>;
      unknownMember: ReadonlyArray<QuizResultUnknownMemberViewModel>;
    };
    failedQuizNotTrained: {
      knownMember: ReadonlyArray<QuizResultViewModel>;
    };
  }
> => {
  const members = readModels.members.getAllDetails(events);
  const membersByEmail = indexMembersByEmail(members);
  const quizEvents = getQuizEvents(equipment)(events);
  const trainedMembers = getMembersTrainedOn(equipment.id)(events);
  const memberResults = reduceToLatestQuizResultByMember(
    members,
    membersByEmail,
    quizEvents
  );

  return TE.right({
    lastRefresh: deps.lastTrainingQuizResultRefresh,
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
  areaId: UUID,
  memberNumber: number
): boolean =>
  readModels.superUsers.is(memberNumber)(events) ||
  readModels.areas.isOwner(events)(areaId, memberNumber);

const isSuperUserOrTrainerOfEquipment = (
  events: ReadonlyArray<DomainEvent>,
  equipment: Equipment,
  memberNumber: number
): boolean =>
  readModels.superUsers.is(memberNumber)(events) ||
  equipment.trainers.includes(memberNumber);

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: UUID): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      {user},
      TE.right,
      TE.bind('events', () => deps.getAllEvents()),
      TE.bind('equipment', ({events}) => getEquipment(events, equipmentId)),
      TE.let('isSuperUserOrOwnerOfArea', ({events, equipment}) =>
        isSuperUserOrOwnerOfArea(events, equipment.areaId, user.memberNumber)
      ),
      TE.let('isSuperUserOrTrainerOfArea', ({events, equipment}) =>
        isSuperUserOrTrainerOfEquipment(events, equipment, user.memberNumber)
      ),
      TE.bindW('trainingQuizResults', ({events, equipment}) =>
        getQuizResults(events, equipment, deps)
      )
    );
