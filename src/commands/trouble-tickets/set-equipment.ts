import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {canSetTicketEquipment} from './authorization';

const codec = t.strict({
  ticketId: tt.UUID,
  // null (API) or '' (the form's Unassigned option) re-buckets the ticket to Unassigned.
  equipmentId: t.union([tt.UUID, t.null, t.literal('')]),
});

type SetTroubleTicketEquipment = t.TypeOf<typeof codec>;

// An owner overrides which equipment a ticket relates to.
const process: Command<SetTroubleTicketEquipment>['process'] = input =>
  pipe(
    input.rm.troubleTickets.getById(input.command.ticketId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested trouble ticket does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.chain(() => {
      const equipmentId =
        input.command.equipmentId === '' ? null : input.command.equipmentId;
      if (
        equipmentId !== null &&
        O.isNone(input.rm.equipment.get(equipmentId))
      ) {
        return TE.left(
          failureWithStatus(
            'The requested equipment does not exist',
            StatusCodes.BAD_REQUEST
          )()
        );
      }
      return TE.right(
        O.some(
          constructEvent('TroubleTicketEquipmentSet')({
            ticketId: input.command.ticketId,
            equipmentId,
            actor: input.command.actor,
          })
        )
      );
    })
  );

export const setEquipment: Command<SetTroubleTicketEquipment> = {
  process,
  decode: codec.decode,
  isAuthorized: canSetTicketEquipment,
};
