import {DomainEvent, constructEvent, isEventOfType} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import {QzEventDuplicate} from '../../training-sheets/events';

const codec = t.strict({
  equipmentId: tt.UUID,
  trainingSheetId: t.string,
  id: tt.UUID,
  emailProvided: t.string,
  memberNumberProvided: t.number,
  score: t.number,
  maxScore: t.number,
  percentage: t.number,
  fullMarks: t.boolean,
  timestampEpochS: t.number,
  quizAnswers: t.record(t.string, t.union([t.string, t.null])),
});

type RegisterTrainingSheetQuizResult = t.TypeOf<typeof codec>;

const process = (input: {
  command: RegisterTrainingSheetQuizResult;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> => {
  const newEvent = constructEvent('EquipmentTrainingQuizResult')(input.command);
  return pipe(
    input.events,
    RA.filter(isEventOfType('EquipmentTrainingQuizResult')),
    RA.filter(event => QzEventDuplicate.equals(newEvent, event)),
    RA.match(
      () => O.some(newEvent),
      () => O.none
    )
  );
};

const resource = (command: RegisterTrainingSheetQuizResult) => ({
  type: 'Equipment',
  id: command.equipmentId,
});

export const registerTrainingSheetQuizResult: Command<RegisterTrainingSheetQuizResult> =
  {
    process,
    resource,
    decode: codec.decode,
    isAuthorized: isAdminOrSuperUser,
  };
