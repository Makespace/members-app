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
import {startSpan} from '@sentry/node';

export const applyToResource =
  <T>(deps: Dependencies, command: Command<T>) =>
  (
    input: T,
    actor: Actor
  ): TE.TaskEither<
    FailureWithStatus,
    {status: StatusCodes.CREATED; message: string}
  > => {
    const resource = command.resource(input);
    const inputAndActor = {...input, actor};
    const commandName = command.decode.name || 'unknown';
    return () =>
      startSpan(
        {
          name: `Apply command ${commandName}`,
          op: 'command.apply',
          attributes: {
            'command.name': commandName,
            'resource.type': resource.type,
            'resource.id': resource.id,
          },
        },
        () =>
          pipe(
            resource,
            deps.getResourceEvents,
            TE.bind('event', ({events}) =>
              command.process({command: inputAndActor, events, rm: deps.sharedReadModel, deps})
            ),
            TE.chain(({event, version}) => O.isSome(event) ? deps.commitEvent(resource, version)(event.value) : TE.right({
              status: StatusCodes.CREATED as StatusCodes.CREATED,
              message: 'Success'
            }))
          )()
      );
  };
