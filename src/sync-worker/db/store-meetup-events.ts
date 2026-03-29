import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {inspect} from 'node:util';
import {MeetupEvent} from '../meetup/fetch-meetup-ical';

export const storeMeetupEvents =
  (googleDB: Client) =>
  (data: ReadonlyArray<MeetupEvent>): TE.TaskEither<string, void> =>
    pipe(
      data,
      RA.map(event =>
        TE.tryCatch(
          () =>
            googleDB.execute({
              sql: `INSERT OR REPLACE INTO meetup_event_data(
                uid, summary, description, location, dtstart, dtend, url, cached_at
              ) VALUES (
                $uid, $summary, $description, $location, $dtstart, $dtend, $url, $cached_at
              )`,
              args: {
                $uid: event.uid,
                $summary: event.summary,
                $description: event.description,
                $location: event.location,
                $dtstart: event.dtstart.getTime(),
                $dtend: event.dtend.getTime(),
                $url: event.url,
                $cached_at: Date.now(),
              },
            }),
          reason =>
            `Failed to insert meetup event '${inspect(event)}': ${(reason as Error).message}`
        )
      ),
      TE.sequenceArray,
      TE.map(() => {})
    );
