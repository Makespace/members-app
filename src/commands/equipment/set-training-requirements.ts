import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {SharedReadModel} from '../../read-models/shared-state';
import {Command} from '../command';
import {isAdminSuperUserOrOwningTrainerForEquipment} from '../authentication-helpers/is-admin-or-super-user-or-owning-trainer';

// What the form sends: a ticked checkbox sends its value and an unticked one
// sends nothing, so "quiz required" is there or not, and the machines to be
// trained on first come as nothing, one id, or several.
const formCodec = t.intersection([
  t.strict({equipmentId: tt.UUID}),
  t.partial({
    quizRequired: t.string,
    prerequisites: t.union([tt.UUID, t.array(tt.UUID)]),
  }),
]);

const SetTrainingRequirementsCodec = t.strict({
  equipmentId: tt.UUID,
  quizRequired: t.boolean,
  prerequisiteEquipmentIds: t.array(tt.UUID),
});

type SetTrainingRequirements = t.TypeOf<typeof SetTrainingRequirementsCodec>;

const codec = new t.Type<
  SetTrainingRequirements,
  SetTrainingRequirements,
  unknown
>(
  'SetTrainingRequirements',
  SetTrainingRequirementsCodec.is,
  (input, context) =>
    pipe(
      formCodec.validate(input, context),
      E.map(form => ({
        equipmentId: form.equipmentId,
        quizRequired: form.quizRequired !== undefined,
        prerequisiteEquipmentIds: [
          ...new Set(
            form.prerequisites === undefined
              ? []
              : typeof form.prerequisites === 'string'
                ? [form.prerequisites]
                : form.prerequisites
          ),
        ],
      }))
    ),
  t.identity
);

// Would the member have to be trained on `target` before `from`, following
// the requirements already set? Then making `target` need `from` would leave
// neither reachable.
const leadsTo = (
  rm: SharedReadModel,
  from: UUID,
  target: UUID,
  seen: Set<string> = new Set()
): boolean => {
  if (from === target) {
    return true;
  }
  if (seen.has(from)) {
    return false;
  }
  seen.add(from);
  return rm.trainingRequirements
    .get(from)
    .prerequisiteEquipmentIds.some(next => leadsTo(rm, next, target, seen));
};

const refusal = (message: string) =>
  TE.left(failureWithStatus(message, StatusCodes.BAD_REQUEST)());

const process: Command<SetTrainingRequirements>['process'] = input => {
  const {equipmentId, quizRequired, prerequisiteEquipmentIds} = input.command;
  const rm = input.rm;
  if (O.isNone(rm.equipment.get(equipmentId))) {
    return TE.left(
      failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
    );
  }
  if (prerequisiteEquipmentIds.includes(equipmentId)) {
    return refusal('A machine cannot need training on itself first');
  }
  const unknown = prerequisiteEquipmentIds.find(id =>
    O.isNone(rm.equipment.get(id))
  );
  if (unknown !== undefined) {
    return refusal(`Unknown equipment ${unknown}`);
  }
  const loop = prerequisiteEquipmentIds.find(id =>
    leadsTo(rm, id, equipmentId)
  );
  if (loop !== undefined) {
    return refusal(
      `${pipe(
        rm.equipment.get(loop),
        O.match(
          () => 'That machine',
          equipment => equipment.name
        )
      )} already needs training on this machine first, so each would wait on the other`
    );
  }
  const current = rm.trainingRequirements.get(equipmentId);
  const unchanged =
    current.quizRequired === quizRequired &&
    current.prerequisiteEquipmentIds.length ===
      prerequisiteEquipmentIds.length &&
    prerequisiteEquipmentIds.every(id =>
      current.prerequisiteEquipmentIds.includes(id)
    );
  return TE.right(
    unchanged
      ? O.none
      : O.some(
          constructEvent('EquipmentTrainingRequirementsSet')({
            equipmentId,
            quizRequired,
            prerequisiteEquipmentIds,
            actor: input.command.actor,
          })
        )
  );
};

export const setTrainingRequirements: Command<SetTrainingRequirements> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrOwningTrainerForEquipment,
};
