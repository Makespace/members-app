import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import { pipe } from 'fp-ts/lib/function';
import { FailureWithStatus, failureWithStatus } from '../../types/failure-with-status';
import { StatusCodes } from 'http-status-codes';

const codec = t.strict({
  event_id: tt.UUID,
  reason: t.string,
});

export type ExcludeEvent = t.TypeOf<typeof codec>;

const process: Command<ExcludeEvent>['process'] = input => pipe(
  input.command.actor.tag === 'user'
  ? TE.right<FailureWithStatus, number>(input.command.actor.user.memberNumber)
  : TE.left(failureWithStatus('Unknown user', StatusCodes.BAD_REQUEST)()),
  TE.chain(memberNumber => input.deps.excludeEvent(
    input.command.event_id,
    memberNumber,
    input.command.reason,
  )),
  TE.map(() => O.none)
);

const resource = () => ({
  type: 'ExcludeEvent',
  id: 'ExcludeEvent',
});

export const excludeEvent: Command<ExcludeEvent> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
