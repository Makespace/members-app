import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';

export type MeetupEventRow = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  dtstart: number;
  dtend: number;
  url: string | null;
  cached_at: number;
};

export const getMeetupEvents =
  (googleDB: Client) => (): TE.TaskEither<string, ReadonlyArray<MeetupEventRow>> =>
    pipe(
      TE.tryCatch(
        async () => {
          const result = await googleDB.execute(
            'SELECT uid, summary, description, location, dtstart, dtend, url, cached_at FROM meetup_event_data ORDER BY dtstart ASC'
          );
          return result.rows as unknown as MeetupEventRow[];
        },
        reason =>
          `Failed to get meetup events: ${(reason as Error).message}`
      )
    );
