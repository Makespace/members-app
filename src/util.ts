import {Logger} from 'pino';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';

export const logPassThru =
  (logger: Logger, msg: string) =>
  <T>(input: T) => {
    logger.info(msg);
    return input;
  };

export const getChunkIndexes = (
  startInclusive: number,
  endInclusive: number,
  chunkSize: number
): [number, number][] => {
  const result: [number, number][] = [];
  let start = startInclusive;
  while (start < endInclusive) {
    let end = start + chunkSize;
    end = end > endInclusive ? endInclusive : end;
    result.push([start, end]);
    start = end + 1;
  }
  return result;
};

export const withDefaultIfEmpty = <C extends t.Any>(
  codec: C,
  ifEmpty: t.TypeOf<C>
) =>
  tt.withValidate(codec, (input, context) =>
    pipe(
      tt.NonEmptyString.validate(input, context),
      E.orElse(() => t.success(String(ifEmpty))),
      E.chain(nonEmptyString => codec.validate(nonEmptyString, context))
    )
  );
