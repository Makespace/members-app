import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/equipment-training/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// The page answers "what do I do next?" for the member reading it, so what it
// shows is their own quiz history, not the queue of everybody waiting.
describe('how far a member has got with training', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const sheetId = 'a-training-sheet' as NonEmptyString;
  const member = arbitraryUser();

  const progress = async () =>
    getRightOrFail(
      await constructViewModel(framework.depsForCommands, member)(equipmentId)()
    ).progress;

  const quizAttempt = (score: number, maxScore: number, completedAt: Date) =>
    framework.commands.trainingQuiz.record({
      trainingSheetId: sheetId,
      completedAt,
      memberNumberProvided: member.memberNumber,
      emailProvided: null,
      score: score as Int,
      maxScore: maxScore as Int,
      rowHash: faker.string.alphanumeric(64) as NonEmptyString,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: member.memberNumber,
      email: member.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('says there is no quiz when none is registered for the equipment', async () => {
    expect(await progress()).toStrictEqual({tag: 'no-quiz'});
  });

  describe('with a quiz registered', () => {
    beforeEach(async () => {
      await framework.commands.equipment.trainingSheet({
        equipmentId,
        trainingSheetId: sheetId,
      });
    });

    it('asks a member who has not taken it to take it', async () => {
      expect(await progress()).toStrictEqual({tag: 'not-attempted'});
    });

    it('reports the best attempt when none of them passed', async () => {
      await quizAttempt(4, 10, new Date('2026-01-02'));
      await quizAttempt(7, 10, new Date('2026-02-03'));

      expect(await progress()).toStrictEqual({
        tag: 'failed',
        score: 7,
        maxScore: 10,
        completedAt: new Date('2026-02-03'),
      });
    });

    it('confirms a pass, dated from when they first passed', async () => {
      await quizAttempt(3, 10, new Date('2026-01-02'));
      await quizAttempt(10, 10, new Date('2026-03-04'));
      await quizAttempt(10, 10, new Date('2026-04-05'));

      expect(await progress()).toStrictEqual({
        tag: 'passed',
        completedAt: new Date('2026-03-04'),
      });
    });

    it('ignores quizzes belonging to other equipment', async () => {
      await framework.commands.trainingQuiz.record({
        trainingSheetId: 'someone-elses-sheet' as NonEmptyString,
        completedAt: new Date('2026-01-02'),
        memberNumberProvided: member.memberNumber,
        emailProvided: null,
        score: 10 as Int,
        maxScore: 10 as Int,
        rowHash: faker.string.alphanumeric(64) as NonEmptyString,
      });

      expect(await progress()).toStrictEqual({tag: 'not-attempted'});
    });

    // Being trained is the end of the road, whatever the quiz history says -
    // plenty of members were trained before the quiz existed.
    it('says a trained member is trained, without mentioning the quiz', async () => {
      await framework.commands.trainers.markTrained({
        equipmentId,
        memberNumber: member.memberNumber as Int,
      });

      const result = await progress();
      expect(result.tag).toBe('trained');
    });
  });

  it('carries the area, so the page can say who to email', async () => {
    const viewModel = getRightOrFail(
      await constructViewModel(framework.depsForCommands, member)(equipmentId)()
    );

    expect(viewModel.area.name).toBe('Wood Shop');
    expect(viewModel.equipment.name).toBe('Band Saw');
    expect(viewModel.guideUrl).toBe(
      'https://equipment.makespace.org/wood-shop/band-saw'
    );
  });

  it('is not found for equipment that does not exist', async () => {
    const result = await constructViewModel(
      framework.depsForCommands,
      member
    )(faker.string.uuid() as UUID)();

    expect(O.isNone(O.fromEither(result))).toBe(true);
  });
});
