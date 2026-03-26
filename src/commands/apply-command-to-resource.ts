import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {Command} from '.';
import {Actor} from '../types/actor';
import {
  FailureWithStatus,
} from '../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import { CommandDependencies } from './command';

export const applyToResource =
  <T>(deps: CommandDependencies, command: Command<T>) =>
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
      TE.bind('event', ({events}) =>
        command.process({command: inputAndActor, events, deps}),
      ),
      // If no event is raised then we still treat it as success to the user as they don't care about the difference -> if we want to raise an error then use TE.Left.
      TE.chain(({event, version}) => O.isSome(event) ? deps.commitEvent(resource, version)(event.value) : TE.right({status: StatusCodes.CREATED, message: 'Success'}))
    );
  };
