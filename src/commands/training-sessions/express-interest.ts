import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {Command} from '../command';

const codec = t.strict({equipmentId: tt.UUID});

type ExpressInterest = t.TypeOf<typeof codec>;

// A member telling a machine's trainers they would like to be trained on it.
// Every time counts: saying it again is how a member shows the wish is still
// current, and trainers read the latest.
const process: Command<ExpressInterest>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)),
    TE.map(equipment =>
      input.command.actor.tag !== 'user'
        ? O.none
        : O.some(
            constructEvent('TrainingInterestExpressed')({
              equipmentId: equipment.id,
              memberNumber: input.command.actor.user.memberNumber,
              actor: input.command.actor,
            })
          )
    )
  );

export const expressInterest: Command<ExpressInterest> = {
  process,
  decode: codec.decode,
  isAuthorized: ({actor}) => actor.tag === 'user',
};
