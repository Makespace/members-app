import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import {record} from '../../../src/commands/training-quiz/record';
import {constructEvent} from '../../../src/types';
import {arbitraryActor, getTaskEitherRightOrFail} from '../../helpers';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';

const arbitraryCompletion = () => ({
  trainingSheetId: faker.string.alphanumeric(10) as NonEmptyString,
  completedAt: faker.date.past(),
  memberNumberProvided: faker.number.int({min: 1}),
  emailProvided: faker.internet.email(),
  score: 10 as Int,
  maxScore: 10 as Int,
  rowHash: faker.string.alphanumeric(64) as NonEmptyString,
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
  describe('decoding input', () => {
    it('accepts a well-formed completion', () => {
      const valid = {
        ...arbitraryCompletion(),
        completedAt: '2024-01-01T00:00:00.000Z',
      };
      expect(E.isRight(record.decode(valid))).toBe(true);
    });

    it('rejects an empty rowHash (it is the dedup sentinel)', () => {
      const valid = {
        ...arbitraryCompletion(),
        completedAt: '2024-01-01T00:00:00.000Z',
      };
      expect(E.isLeft(record.decode({...valid, rowHash: ''}))).toBe(true);
    });

    it('rejects non-integer scores', () => {
      const valid = {
        ...arbitraryCompletion(),
        completedAt: '2024-01-01T00:00:00.000Z',
      };
      expect(E.isLeft(record.decode({...valid, score: NaN}))).toBe(true);
      expect(E.isLeft(record.decode({...valid, maxScore: 9.5}))).toBe(true);
    });
  });
});
