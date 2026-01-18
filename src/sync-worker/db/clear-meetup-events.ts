import {Client} from '@libsql/client';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';

export const clearMeetupEvents =
  (googleDB: Client) => (): TE.TaskEither<string, void> =>
    pipe(
      TE.tryCatch(
        () => googleDB.execute('DELETE FROM meetup_event_data'),
        reason =>
          `Failed to clear meetup events: ${(reason as Error).message}`
      ),
      TE.map(() => {})
    );
