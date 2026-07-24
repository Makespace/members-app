import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../test-framework';

const arbitraryCompletion = () => ({
  trainingSheetId: faker.string.alphanumeric(10),
  completedAt: faker.date.past(),
  memberNumberProvided: faker.number.int({min: 1}),
  emailProvided: faker.internet.email(),
  score: 8,
  maxScore: 10,
  rowHash: faker.string.alphanumeric(64),
});

describe('training quiz completions read model', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when a quiz completion has been recorded', () => {
    it('projects the row hash so it is recognised as imported', async () => {
      const completion = arbitraryCompletion();

      await framework.commands.trainingQuiz.record(completion);

      expect(
        framework.sharedReadModel.trainingQuiz.hasRowHash(completion.rowHash)
      ).toBe(true);
      expect(
        framework.sharedReadModel.trainingQuiz
          .importedRowHashes()
          .has(completion.rowHash)
      ).toBe(true);
    });
  });

  describe('when no completion has been recorded', () => {
    it('does not recognise the hash', () => {
      expect(
        framework.sharedReadModel.trainingQuiz.hasRowHash(
          faker.string.alphanumeric(64)
        )
      ).toBe(false);
      expect(
        framework.sharedReadModel.trainingQuiz.importedRowHashes().size
      ).toBe(0);
    });
  });

  describe('when the same completion is recorded twice', () => {
    it('keeps a single imported row (dedup by hash)', async () => {
      const completion = arbitraryCompletion();

      await framework.commands.trainingQuiz.record(completion);
      await framework.commands.trainingQuiz.record(completion);

      expect(
        framework.sharedReadModel.trainingQuiz.importedRowHashes().size
      ).toBe(1);
    });
  });
});
