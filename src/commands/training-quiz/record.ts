import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

const codec = t.strict({
  trainingSheetId: t.string,
  completedAt: tt.DateFromISOString,
  memberNumberProvided: t.union([t.number, t.null]),
  emailProvided: t.union([t.string, t.null]),
  score: t.number,
  maxScore: t.number,
  rowHash: t.string,
});

type RecordTrainingQuizCompletion = t.TypeOf<typeof codec>;

// Records one quiz completion as an event, unless a row with the same hash has
// already been imported (dedup). Stores only the raw sheet facts - no member or
// equipment resolution.
const process: Command<RecordTrainingQuizCompletion>['process'] = input =>
  TE.right(
    input.rm.trainingQuiz.hasRowHash(input.command.rowHash)
      ? O.none
      : O.some(constructEvent('TrainingQuizCompleted')(input.command))
  );

export const record: Command<RecordTrainingQuizCompletion> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
