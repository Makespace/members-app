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

type Deps = Pick<Dependencies, 'commitEvent' | 'getResourceEvents'>;

export const applyToResource =
  <T>(deps: Deps, command: Command<T>) =>
  (
    input: T,
    actor: Actor
  ): TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  > => {
    const resource = command.resource(input);
    const inputAndActor = {...input, actor};
    return pipe(
      resource,
      deps.getResourceEvents,
      TE.bind('event', ({events}) => command.process({command: inputAndActor, events})),
      TE.chain(({event, version}) => O.isSome(event) ? deps.commitEvent(resource, version)(event.value) : TE.right({
        status: StatusCodes.CREATED as StatusCodes.CREATED,
        message: 'Success'
      }))
    );
  };
