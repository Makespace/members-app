/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {flow, pipe} from 'fp-ts/lib/function';
import * as R from 'fp-ts/Record';

export type TaggedUnion<
  T extends Record<string, (...args: any[]) => Record<string, unknown>>,
> = {
  [K in keyof T]: {_tag: K} & ReturnType<T[K]>;
}[keyof T];

type TaggedConstructors<
  T extends Record<string, (...args: any[]) => Record<string, unknown>>,
> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => ReturnType<T[K]> & {_tag: K};
};

export type Member<T extends {_tag: string}, K extends T['_tag']> = T & {
  _tag: K;
};

export const toTaggedContructors = <
  A extends Record<string, (...args: any[]) => Record<string, unknown>>,
>(
  taglessConstructors: A
): TaggedConstructors<A> =>
  pipe(
    taglessConstructors,
    R.mapWithIndex((key, constructor) =>
      flow(constructor, partial => ({...partial, _tag: key}))
    ),
    taggedContructors => taggedContructors as unknown as TaggedConstructors<A>
  );

/*
This matching code is based on pfgray/ts-adt (MIT License)
*/

type MakeCases<T extends string, U extends Record<T, string>, Z> = {
  [K in U[T]]: (v: Extract<U, Record<T, K>>) => Z;
};

type MakeReturns<
  D extends string,
  U extends Record<D, string>,
  M extends MakeCases<D, U, unknown>,
> = {
  [K in keyof M]: ReturnType<M[K]>;
}[keyof M];

type MatchOn = <
  T extends string,
  A extends Record<T, string>,
  C extends MakeCases<T, A, unknown>,
>(
  discriminant: T,
  matchObj: C
) => (input: A) => MakeReturns<T, A, C>;

const matchOn: MatchOn = (discriminant, cases) => input => {
  return cases[input[discriminant]](input as any) as any;
};

type MakeMatch = <D extends string>(
  discriminant: D
) => <A extends Record<D, string>, C extends MakeCases<D, A, unknown>>(
  cases: C
) => (input: A) => MakeReturns<D, A, C>;

const makeMatch: MakeMatch = discriminant => cases =>
  matchOn(discriminant, cases);

export const match = makeMatch('_tag');
