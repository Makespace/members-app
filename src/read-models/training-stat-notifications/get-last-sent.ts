import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent, filterByName} from '../../types/domain-event';
import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {FailureWithStatus} from '../../types/failure-with-status';
import {ResourceVersion} from '../../types';
import {Resource} from '../../types/resource';
import {DateTime} from 'luxon';

const getTrainingSummaryNotificationResource = (
  memberNumber: number
): Resource => ({
  type: 'training_summary_notification',
  id: memberNumber.toString(),
});

const getLastNotificationFromEvents = (
  events: ReadonlyArray<DomainEvent>
): O.Option<Date> =>
  pipe(
    events,
    filterByName(['TrainingStatNotificationSent' as const]),
    RA.reduce<DomainEvent, O.Option<Date>>(
      O.none,
      (mostRecentSoFar, current) => {
        if (O.isNone(mostRecentSoFar)) {
          return O.some(current.recordedAt);
        }
        if (mostRecentSoFar.value.getTime() < current.recordedAt.getTime()) {
          return O.some(current.recordedAt);
        }
        return mostRecentSoFar;
      }
    )
  );

export const getLastNotificationSent =
  (deps: Pick<Dependencies, 'getResourceEvents'>) =>
  (
    memberNumber: number
  ): TE.TaskEither<
    FailureWithStatus,
    {
      resource: Resource;
      resourceVersion: ResourceVersion;
      lastNotification: O.Option<DateTime>;
    }
  > => {
    const resource = getTrainingSummaryNotificationResource(memberNumber);
    return pipe(
      resource,
      deps.getResourceEvents,
      TE.map(events => ({
        lastNotification: pipe(
          events.events,
          getLastNotificationFromEvents,
          O.map(DateTime.fromJSDate)
        ),
        resource,
        resourceVersion: events.version,
      }))
    );
  };
