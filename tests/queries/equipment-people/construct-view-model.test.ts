import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {EmailAddress} from '../../../src/types';
import {
  constructViewModel,
  TrainingRow,
} from '../../../src/queries/equipment-people/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// The search on the quiz-results page finds one person, and says where
// they stand with the quiz whether or not they have passed it.
describe('searching for a member on the quiz-results page', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const trainingSheetId = 'sheet-for-the-search' as NonEmptyString;
  const trainer = arbitraryUser();

  // Fixed, placeholder people: the search is about finding them by what
  // was typed, so the values have to be known.
  const passed = {
    memberNumber: 872,
    email: 'pat.passed@example.com' as EmailAddress,
    name: 'Pat Passed',
  };
  const notPassed = {
    memberNumber: 1872,
    email: 'nat.newcomer@example.com' as EmailAddress,
    name: 'Nat Newcomer',
  };
  const trained = {
    memberNumber: 3000,
    email: 'tam.trained@example.com' as EmailAddress,
    name: 'Tam Trained',
  };
  // A pass typed with a number nobody has, but an address somebody does.
  const mistypedNumber = 987654;

  const link = (person: {memberNumber: number; email: EmailAddress; name: string}) =>
    framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: person.memberNumber,
      email: person.email,
      name: person.name,
      formOfAddress: undefined,
    });

  const pass = (memberNumber: number, email: string, at: Date) =>
    framework.commands.trainingQuiz.record({
      trainingSheetId,
      completedAt: at,
      memberNumberProvided: memberNumber,
      emailProvided: email,
      score: 10 as Int,
      maxScore: 10 as Int,
      rowHash: faker.string.uuid() as NonEmptyString,
    });

  const view = async (query: O.Option<string>) =>
    getRightOrFail(
      await constructViewModel(framework.depsForCommands, trainer)(
        equipmentId,
        query
      )()
    );

  const resultsFor = async (query: string) => {
    const model = await view(O.some(query));
    if (O.isNone(model.search)) {
      throw new Error('expected a search');
    }
    return model.search.value.results;
  };

  const memberNumbersOf = (rows: ReadonlyArray<TrainingRow>) =>
    rows.map(row =>
      row.kind === 'member' ? row.person.memberNumber : 'unknown'
    );

  beforeEach(async () => {
    framework = await initTestFramework();
    await link({
      memberNumber: trainer.memberNumber,
      email: trainer.emailAddress,
      name: 'The Trainer',
    });
    await link(passed);
    await link(notPassed);
    await link(trained);
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    await framework.commands.equipment.trainingSheet({
      equipmentId,
      trainingSheetId,
    });
    await framework.commands.trainers.add({
      equipmentId,
      memberNumber: trainer.memberNumber,
    });
    await framework.commands.trainers.markTrained({
      equipmentId,
      memberNumber: trained.memberNumber as Int,
    });
    await pass(passed.memberNumber, passed.email, new Date('2026-09-10'));
    await pass(trained.memberNumber, trained.email, new Date('2026-09-11'));
    await pass(mistypedNumber, notPassed.email, new Date('2026-09-12'));
  });

  afterEach(() => {
    framework.close();
  });

  it('has no search until something is typed', async () => {
    expect((await view(O.none)).search).toStrictEqual(O.none);
    expect((await view(O.some('   '))).search).toStrictEqual(O.none);
  });

  // 872 is one person, not everybody with 872 somewhere in their address
  // or a number that merely contains it.
  it('takes a number as exactly that member number', async () => {
    expect(memberNumbersOf(await resultsFor('872'))).toStrictEqual([872]);
  });

  it('finds part of a name, whatever the case', async () => {
    expect(memberNumbersOf(await resultsFor('NAT NEW'))).toStrictEqual([
      notPassed.memberNumber,
    ]);
  });

  it('finds part of an address', async () => {
    expect(memberNumbersOf(await resultsFor('tam.trained@'))).toStrictEqual([
      trained.memberNumber,
    ]);
  });

  it('says where each match stands with the quiz', async () => {
    const standings = (await resultsFor('@example.com'))
      .flatMap(row => (row.kind === 'member' ? [row] : []))
      .map(row => [row.person.memberNumber, row.standing.kind]);

    expect(standings).toEqual(
      expect.arrayContaining([
        [passed.memberNumber, 'passed'],
        [notPassed.memberNumber, 'not-passed'],
        [trained.memberNumber, 'trained'],
      ])
    );
  });

  it('finds an unmatched pass by the number that was typed', async () => {
    const rows = await resultsFor(String(mistypedNumber));

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('unknown');
  });

  describe('the waiting list', () => {
    it('holds the known passes and the unmatched ones together, newest first', async () => {
      const waiting = (await view(O.none)).waiting;

      expect(waiting.map(row => row.kind)).toStrictEqual(['unknown', 'member']);
      expect(memberNumbersOf(waiting)).toStrictEqual([
        'unknown',
        passed.memberNumber,
      ]);
    });

    it('leaves out whoever has been trained since passing', async () => {
      expect(memberNumbersOf((await view(O.none)).waiting)).not.toContain(
        trained.memberNumber
      );
    });

    // The number was typed wrong, but the address is a member's: say so.
    it('names the member whose address an unmatched pass carries', async () => {
      const unknown = (await view(O.none)).waiting.find(
        row => row.kind === 'unknown'
      );

      expect(unknown?.kind).toBe('unknown');
      if (unknown?.kind !== 'unknown') return;
      expect(unknown.memberNumberProvided).toStrictEqual(O.some(mistypedNumber));
      expect(
        O.map((match: {memberNumber: number}) => match.memberNumber)(
          unknown.possibleMatch
        )
      ).toStrictEqual(O.some(notPassed.memberNumber));
    });
  });
});
