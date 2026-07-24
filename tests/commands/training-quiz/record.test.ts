import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {record} from '../../../src/commands/training-quiz/record';
import {constructEvent} from '../../../src/types';
import {arbitraryActor, getTaskEitherRightOrFail} from '../../helpers';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';

const arbitraryCompletion = () => ({
  trainingSheetId: faker.string.alphanumeric(10),
  completedAt: faker.date.past(),
  memberNumberProvided: faker.number.int({min: 1}),
  emailProvided: faker.internet.email(),
  score: 10,
  maxScore: 10,
  rowHash: faker.string.alphanumeric(64),
});

describe('record-training-quiz-completion', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the row has not yet been imported', () => {
    it('emits a TrainingQuizCompleted event carrying the raw sheet facts', async () => {
      const completion = arbitraryCompletion();

      const result = await getTaskEitherRightOrFail(
        record.process({
          command: {...completion, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'TrainingQuizCompleted',
            ...completion,
          })
        )
      );
    });

    it('records the sheet-provided email even when no member number is given', async () => {
      const completion = {
        ...arbitraryCompletion(),
        memberNumberProvided: null,
      };

      const result = await getTaskEitherRightOrFail(
        record.process({
          command: {...completion, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'TrainingQuizCompleted',
            memberNumberProvided: null,
            emailProvided: completion.emailProvided,
          })
        )
      );
    });
  });

  describe('when a row with the same hash has already been imported', () => {
    it('does nothing (dedup by hash)', async () => {
      const completion = arbitraryCompletion();
      framework.insertIntoSharedReadModel(
        constructEvent('TrainingQuizCompleted')({
          ...completion,
          actor: arbitraryActor(),
        })
      );

      const result = await getTaskEitherRightOrFail(
        record.process({
          command: {...completion, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(O.none);
    });

    it('still emits for a different row (different hash)', async () => {
      const alreadyImported = arbitraryCompletion();
      framework.insertIntoSharedReadModel(
        constructEvent('TrainingQuizCompleted')({
          ...alreadyImported,
          actor: arbitraryActor(),
        })
      );
      const other = arbitraryCompletion();

      const result = await getTaskEitherRightOrFail(
        record.process({
          command: {...other, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'TrainingQuizCompleted',
            rowHash: other.rowHash,
          })
        )
      );
    });
  });
});
