import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as A from 'fp-ts/Array';
import * as t from 'io-ts';

import {DateTime} from 'luxon';
import {EpochTimestampMilliseconds} from '../../shared-state/return-types';
import {pipe} from 'fp-ts/lib/function';

// Bounds to prevent clearly broken parsing.
const MIN_RECOGNISED_MEMBER_NUMBER = 0;
const MAX_RECOGNISED_MEMBER_NUMBER = 10_000;

const MAX_RECOGNISED_SCORE = 10_000;
const MIN_RECOGNISED_SCORE = 0;

const MIN_VALID_TIMESTAMP_EPOCH_MS =
  1546304461_000 as EpochTimestampMilliseconds; // Year 2019, Can't see any training results before this.

const FORMATS_TO_TRY = [
  'dd/MM/yyyy HH:mm:ss',
  'MM/dd/yyyy HH:mm:ss',
  'M/dd/yyyy HH:mm:ss',
  'dd/M/yyyy HH:mm:ss',
  'M/d/yyyy HH:mm:ss',
  'd/M/yyyy HH:mm:ss',

  'dd/MM/yyyy H:m:s',
  'MM/dd/yyyy H:m:s',
  'M/dd/yyyy H:m:s',
  'dd/M/yyyy H:m:s',
  'M/d/yyyy H:m:s',
  'd/M/yyyy H:m:s',

  'yyyy-MM-dd HH:mm:ss',
];

export const extractScore = (
  rowValue: string | undefined | null
): O.Option<{
  score: number;
  maxScore: number;
  percentage: number;
}> => {
  if (!rowValue) {
    return O.none;
  }
  const parts = rowValue.split(' / ');
  if (parts.length !== 2) {
    return O.none;
  }

  const score = parseInt(parts[0], 10);
  if (
    isNaN(score) ||
    score < MIN_RECOGNISED_SCORE ||
    score > MAX_RECOGNISED_SCORE
  ) {
    return O.none;
  }

  const maxScore = parseInt(parts[1], 10);
  if (
    isNaN(maxScore) ||
    maxScore < MIN_RECOGNISED_SCORE ||
    maxScore > MAX_RECOGNISED_SCORE ||
    maxScore < score
  ) {
    return O.none;
  }

  const percentage = Math.round((score / maxScore) * 100);

  return O.some({
    score,
    maxScore,
    percentage,
  });
};

export const extractEmail = (
  rowValue: string | undefined | null
): O.Option<string> => {
  if (!rowValue) {
    return O.none;
  }
  // We may want to add further normalisation to user emails such as making them
  // all lowercase (when used as a id) to prevent user confusion.
  return O.some(rowValue.trim());
};

export const extractMemberNumber = (
  rowValue: string | number | undefined | null
): O.Option<number> => {
  if (!rowValue) {
    return O.none;
  }
  if (typeof rowValue === 'string') {
    rowValue = parseInt(rowValue.trim(), 10);
  }

  if (
    isNaN(rowValue) ||
    rowValue <= MIN_RECOGNISED_MEMBER_NUMBER ||
    rowValue > MAX_RECOGNISED_MEMBER_NUMBER
  ) {
    return O.none;
  }

  return O.some(rowValue);
};

const timestampValid = (
  raw: string,
  timezone: string,
  ts: DateTime,
  context: t.Context
): t.Validation<EpochTimestampMilliseconds> => {
  let timestampEpochMS;
  try {
    if (ts.isValid) {
      timestampEpochMS = (ts.toUnixInteger() *
        1000) as EpochTimestampMilliseconds;
    } else {
      return t.failure(
        raw,
        context,
        `Failed to parse timestamp in timezone ${timezone}, reason: ${ts.invalidReason}`
      );
    }
  } catch (e) {
    let errStr = 'unknown';
    if (e instanceof Error) {
      errStr = `${e.name}: ${e.message}`;
    }
    return t.failure(
      raw,
      context,
      `Failed to parse timestamp in timezone ${timezone}, err: ${errStr}`
    );
  }
  if (
    isNaN(timestampEpochMS) ||
    !isFinite(timestampEpochMS) ||
    timestampEpochMS < MIN_VALID_TIMESTAMP_EPOCH_MS ||
    timestampEpochMS > DateTime.utc().toUnixInteger() * 10 * 60 * 1000
  ) {
    return t.failure(
      raw,
      context,
      `Produced timestamp is invalid/out-of-range, timezone: '${timezone}' decoded to ${timestampEpochMS}}`
    );
  }
  return E.right(timestampEpochMS);
};

export const extractTimestamp = (timezone: string) => {
  return new t.Type<
    EpochTimestampMilliseconds,
    EpochTimestampMilliseconds,
    unknown
  >(
    `TimestampTimezone${timezone}`,
    (input: unknown): input is EpochTimestampMilliseconds =>
      typeof input === 'number',
    (input, context) =>
      pipe(
        t.string.validate(input, context),
        E.flatMap(rawStr => {
          for (const format of FORMATS_TO_TRY) {
            const ts = DateTime.fromFormat(rawStr, format, {
              setZone: true,
              zone: timezone,
            });
            const timestampEpochMS = timestampValid(
              rawStr,
              timezone,
              ts,
              context
            );
            if (E.isRight(timestampEpochMS)) {
              return timestampEpochMS;
            }
          }
          return t.failure(rawStr, context, 'Unrecognised timestamp format');
        })
      ),
    t.identity
  );
};

export const grabColumn =
  (values: {formattedValue: string}[]) =>
  <T>(index: number, validator: t.Decode<unknown, T>): t.Validation<T> =>
    pipe(
      values,
      A.lookup(index),
      O.map(val => val.formattedValue),
      O.getOrElse<string | null>(() => null),
      val => validator(val)
    );
