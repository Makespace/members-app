import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {isAreaOwner} from '../authentication-helpers/is-area-owner';

// One name per line, blanks and duplicates dropped. An empty list means the
// record stands for a single machine.
const lines = new t.Type<ReadonlyArray<string>, unknown, unknown>(
  'lines',
  (u): u is ReadonlyArray<string> => Array.isArray(u),
  u => {
    if (typeof u !== 'string') {
      return t.success([]);
    }
    return t.success([
      ...new Set(
        u
          .split('\n')
          .map(line => line.trim())
          .filter(line => line !== '')
      ),
    ]);
  },
  t.identity
);

const codec = t.strict({
  equipmentId: tt.UUID,
  machineNames: lines,
});

type SetEquipmentMachines = t.TypeOf<typeof codec>;

const sameNames = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>
): boolean => a.length === b.length && a.every((name, i) => name === b[i]);

const process: Command<SetEquipmentMachines>['process'] = input =>
  pipe(
    input.rm.equipment.get(input.command.equipmentId),
    TE.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    ),
    TE.map(equipment =>
      sameNames(equipment.machineNames, input.command.machineNames)
        ? O.none
        : O.some(
            constructEvent('EquipmentMachinesSet')({
              equipmentId: input.command.equipmentId,
              machineNames: input.command.machineNames,
              actor: input.command.actor,
            })
          )
    )
  );

// Naming the units is inventory work, like adding orange/green equipment: the
// area's own owners can do it, as can admins.
export const setMachines: Command<SetEquipmentMachines> = {
  process,
  decode: codec.decode,
  isAuthorized: input =>
    isAdminOrSuperUser(input) ||
    pipe(
      input.rm.equipment.get(input.input.equipmentId),
      O.match(
        () => false,
        equipment =>
          isAreaOwner({
            actor: input.actor,
            rm: input.rm,
            input: {areaId: equipment.area.id},
          })
      )
    ),
};
