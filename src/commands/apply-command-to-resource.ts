import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {Command} from '.';
import {Dependencies} from '../dependencies';
import {Actor} from '../types/actor';
import {
  FailureWithStatus,
} from '../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

export const applyToResource =
  <T>(deps: Dependencies, command: Command<T>) =>
  (
    input: T,
    actor: Actor
  ): TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  > => {
    const inputAndActor = {...input, actor};
    return pipe(
      command.process({command: inputAndActor, rm: deps.sharedReadModel, deps}),
      TE.chain((event) => O.isSome(event) ? deps.commitEvent(deps.sharedReadModel.getCurrentEventIndex())(event.value) : TE.right({
        status: StatusCodes.CREATED as StatusCodes.CREATED,
        message: 'Success'
      }))
    );
  };
