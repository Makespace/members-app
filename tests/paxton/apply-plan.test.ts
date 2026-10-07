import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import {applyImportPlan} from '../../src/paxton/apply-plan';
import {planFromForm} from '../../src/paxton/plan-from-form';
import {EmailAddress} from '../../src/types';
import {arbitraryActor, getSomeOrFail} from '../helpers';
import {initTestFramework, TestFramework} from '../read-models/test-framework';

describe('planFromForm', () => {
  it('reads records, removals and skipped rows out of the flat form fields', () => {
    expect(
      planFromForm({
        'member-1': '1337',
        'level-1': '1a - Active Members',
        'name-1': 'Millions, Molly 1337',
        'member-2': '  ',
        'level-2': '1a',
        'name-2': 'Case, Henry',
        'remove-3': 'on',
        'remove-member-3': '42',
        'remove-member-4': '43',
        unrelated: 'x',
      })
    ).toStrictEqual({
      records: [
        {
          memberNumber: '1337',
          fobId: '1',
          accessLevel: '1a - Active Members',
          paxtonName: 'Millions, Molly 1337',
        },
      ],
      removals: [{memberNumber: '42', fobId: '3'}],
      skipped: 1,
    });
  });
});

describe('applyImportPlan', () => {
  let framework: TestFramework;
  const memberNumber = faker.number.int({min: 1, max: 100_000});

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
  });

  afterEach(() => {
    framework.close();
  });

  const fobsOf = (number: number) =>
    getSomeOrFail(framework.sharedReadModel.members.getByMemberNumber(number))
      .fobs;

  it('records and removes fobs through the member commands', async () => {
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 9 as Int,
      accessLevel: '1a' as NonEmptyString,
      paxtonName: 'old' as NonEmptyString,
    });

    const summary = await applyImportPlan(
      framework.depsForCommands,
      arbitraryActor(),
      {
        records: [
          {
            memberNumber: String(memberNumber),
            fobId: '1',
            accessLevel: '1a - Active Members',
            paxtonName: 'Millions, Molly',
          },
          {
            memberNumber: String(memberNumber),
            fobId: '2',
            accessLevel: '1b - Active Members + Stockroom',
            paxtonName: 'Millions, Molly',
          },
        ],
        removals: [{memberNumber: String(memberNumber), fobId: '9'}],
        skipped: 3,
      }
    );

    expect(summary).toStrictEqual({
      recorded: 2,
      removed: 1,
      skipped: 3,
      failures: [],
    });
    expect(fobsOf(memberNumber).map(fob => fob.fobId).sort()).toStrictEqual([
      1, 2,
    ]);
  });

  it('reports a row for an unknown member and carries on', async () => {
    const summary = await applyImportPlan(
      framework.depsForCommands,
      arbitraryActor(),
      {
        records: [
          {
            memberNumber: String(memberNumber + 1),
            fobId: '1',
            accessLevel: '1a',
            paxtonName: 'Nobody',
          },
          {
            memberNumber: String(memberNumber),
            fobId: '2',
            accessLevel: '1a',
            paxtonName: 'Millions, Molly',
          },
        ],
        removals: [],
        skipped: 0,
      }
    );

    expect(summary.recorded).toStrictEqual(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0]).toContain('Fob 1 (Nobody)');
    expect(fobsOf(memberNumber).map(fob => fob.fobId)).toStrictEqual([2]);
  });

  it('reports a member number that is not a number', async () => {
    const summary = await applyImportPlan(
      framework.depsForCommands,
      arbitraryActor(),
      {
        records: [
          {memberNumber: 'abc', fobId: '1', accessLevel: '1a', paxtonName: 'x'},
        ],
        removals: [],
        skipped: 0,
      }
    );
    expect(summary.recorded).toStrictEqual(0);
    expect(summary.failures[0]).toContain('"abc" is not valid');
  });
});
