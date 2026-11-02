import {asc, gt} from 'drizzle-orm';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {meetupTrainingTable} from '../../sync-worker/meetup/meetup-training-table';

export type MeetupTraining = {
  eventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  url: string;
  description: string;
  going: number;
  // 0 when the event has no limit.
  maxTickets: number;
  rsvpsClosed: boolean;
};

// The Meetup trainings that have not finished yet, soonest first, as of the
// last pull.
export const getUpcomingMeetupTrainings =
  (extDB: ExternalStateDB) =>
  async (now: Date): Promise<ReadonlyArray<MeetupTraining>> =>
    (
      await extDB
        .select()
        .from(meetupTrainingTable)
        .where(gt(meetupTrainingTable.endsAt, now))
        .orderBy(asc(meetupTrainingTable.startsAt))
        .all()
    ).map(row => ({
      eventId: row.eventId,
      title: row.title,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      url: row.url,
      description: row.description,
      going: row.going,
      maxTickets: row.maxTickets,
      rsvpsClosed: row.rsvpsClosed,
    }));
