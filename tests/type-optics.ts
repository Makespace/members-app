import * as TE from 'fp-ts/TaskEither';

export type RightOfTaskEither<A extends TE.TaskEither<unknown, unknown>> =
  Extract<Awaited<ReturnType<A>>, {_tag: 'Right'}>['right'];
