import {readFileSync} from 'fs';
import {NonEmptyString} from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {Int} from 'io-ts';
import pino from 'pino';
import {TaskEither} from 'fp-ts/lib/TaskEither';
import {StatusCodes} from 'http-status-codes';

import {legacyTrainingImport} from '../src/training-sheets/legacy-training-import';
import {DomainEvent, EventName, EventOfType} from '../src/types/domain-event';
import {FailureWithStatus} from '../src/types/failure-with-status';
import {Resource} from '../src/types/resource';

async function main() {
  await legacyTrainingImport(
    {
      ADMIN_API_BEARER_TOKEN: '' as NonEmptyString,
      PORT: 1 as Int,
      PUBLIC_URL: '' as NonEmptyString,
      SESSION_SECRET: '' as NonEmptyString,
      SMTP_FROM: '',
      SMTP_HOST: '' as NonEmptyString,
      SMTP_PASSWORD: '',
      SMTP_PORT: 1 as Int,
      SMTP_TLS: false,
      SMTP_USER: '',
      TOKEN_SECRET: '' as NonEmptyString,
      EVENT_DB_URL: '',
      TURSO_TOKEN: '',
      TURSO_SYNC_URL: '',
      LOG_LEVEL: 'trace',
      GOOGLE_RATELIMIT_MS: 10000 as Int,
      GOOGLE_SERVICE_ACCOUNT_KEY_JSON: readFileSync(
        '/home/paul/test-google/credentials_new.json.ignore',
        'utf8'
      ) as NonEmptyString,
      LEGACY_TRAINING_COMPLETE_SHEET:
        '1Do4CbGZ7ndvK0955nBOi1psn7jVxgvRZHhlsQbZR3_Y',
    },
    {
      logger: pino(),
      getAllEventsByType: function <T extends EventName>(
        _eventType: T
      ): TaskEither<FailureWithStatus, ReadonlyArray<EventOfType<T>>> {
        return TE.right([]);
      },
      commitEvent: function (
        _resource: Resource,
        _lastKnownVersion
      ): (
        event: DomainEvent
      ) => TaskEither<
        FailureWithStatus,
        {status: StatusCodes.CREATED; message: string}
      > {
        throw new Error('Function not implemented.');
      },
    }
  );
}

void main();
