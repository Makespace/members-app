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

export const accumByMap =
  <T, R>(accumBy: (a: T) => string | number, map: (a: T[]) => R) =>
  (arr: ReadonlyArray<T>): ReadonlyArray<R> => {
    const accumulated: Record<string | number, T[]> = {};
    for (const el of arr) {
      const key = accumBy(el);
      if (!accumulated[key]) {
        accumulated[key] = [];
      }
      accumulated[key].push(el);
    }
    return Object.values(accumulated).map(map);
  };

export const fieldIsNotNull =
  <K extends string>(key: K) =>
  <T extends Record<K, string | null>>(obj: T): obj is T & {[P in K]: string} =>
    obj[key] !== null;

export const fieldIsUUID =
  <K extends string>(key: K) =>
  <T extends Record<K, string | null>>(
    obj: T
  ): obj is T & {[P in K]: tt.UUID} =>
    E.isRight(tt.UUID.decode(obj[key]));

export const timeAsync =
  (callback: (nanoseconds: number) => void) =>
  async (fn: PromiseLike<void | void[]>) => {
    const start = process.hrtime.bigint();
    const result = await fn;
    // Realistically we aren't going to be have elapsed periods big enough that this conversion back to number is problematic.
    callback(Number(process.hrtime.bigint() - start));
    return result;
  };
