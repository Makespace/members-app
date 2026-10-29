import {SyncWorkerDependencies} from '../dependencies';
import {MeetupEvent} from './fetch-meetup-events';
import {meetupTrainingTable} from './meetup-training-table';

// Trainers name their sessions "... Training", "... training session",
// "Training: ...". Anything with "train" in the title is taken; the odd one
// that slips through the net is not a problem, as the Meetup group is always
// linked as well.
export const isTraining = (event: Pick<MeetupEvent, 'title'>) =>
  /train/i.test(event.title);

// Replaces the cached trainings with what Meetup says now. A pull that fails
// keeps the last good copy, so a hiccup at Meetup does not empty the page.
export const syncMeetupTrainings = async (
  deps: Pick<SyncWorkerDependencies, 'extDB' | 'logger'>,
  fetchEvents: () => Promise<ReadonlyArray<MeetupEvent>>,
  now: Date = new Date()
): Promise<void> => {
  let events: ReadonlyArray<MeetupEvent>;
  try {
    events = await fetchEvents();
  } catch (error) {
    deps.logger.warn(error, 'Could not fetch Meetup events; keeping the last copy');
    return;
  }
  const trainings = events.filter(isTraining);
  // One batch, as the sheet caches are replaced: all or nothing, so a reader
  // never catches the table empty halfway through.
  const clear = deps.extDB.delete(meetupTrainingTable);
  await (trainings.length === 0
    ? deps.extDB.batch([clear])
    : deps.extDB.batch([
        clear,
        deps.extDB
          .insert(meetupTrainingTable)
          .values(
            trainings.map(event => ({
              eventId: event.id,
              title: event.title,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              url: event.url,
              description: event.description,
              going: event.going,
              maxTickets: event.maxTickets,
              rsvpsClosed: event.rsvpsClosed,
              fetchedAt: now,
            }))
          )
          .onConflictDoNothing(),
      ]));
  deps.logger.info(
    {trainings: trainings.length, events: events.length},
    'Pulled Meetup trainings'
  );
};
