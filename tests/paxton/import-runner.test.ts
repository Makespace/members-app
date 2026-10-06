import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {createImportRunner} from '../../src/paxton/import-runner';
import {applyImportPlan} from '../../src/paxton/apply-plan';
import {EmailAddress} from '../../src/types';
import {Dependencies} from '../../src/dependencies';
import {failureWithStatus} from '../../src/types/failure-with-status';
import {arbitraryActor, getRightOrFail, getSomeOrFail} from '../helpers';
import {initTestFramework, TestFramework} from '../read-models/test-framework';

const record = (memberNumber: number, fobId: number) => ({
  memberNumber: String(memberNumber),
  fobId: String(fobId),
  accessLevel: '1a - Active Members',
  paxtonName: 'Millions, Molly',
});

const untilDone = async (current: () => O.Option<{summary: O.Option<unknown>}>) => {
  for (let i = 0; i < 200; ++i) {
    const job = current();
    if (O.isSome(job) && O.isSome(job.value.summary)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('import did not finish');
};

describe('import runner', () => {
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

  it('runs the plan in the background and reports progress then a summary', async () => {
    const runner = createImportRunner();
    expect(runner.current()).toStrictEqual(O.none);

    const job = getRightOrFail(
      runner.start(framework.depsForCommands, arbitraryActor(), {
        records: [record(memberNumber, 1), record(memberNumber, 2)],
        removals: [],
        skipped: 1,
      })
    );
    expect(job.total).toStrictEqual(2);
    expect(O.isSome(runner.current())).toBe(true);

    await untilDone(runner.current);

    const finished = getSomeOrFail(runner.current());
    expect(finished.done).toStrictEqual(2);
    expect(getSomeOrFail(finished.summary)).toStrictEqual({
      recorded: 2,
      removed: 0,
      skipped: 1,
      failures: [],
    });
    expect(
      getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      ).fobs
    ).toHaveLength(2);
  });

  it('refuses a second import while one is running', async () => {
    const runner = createImportRunner();
    getRightOrFail(
      runner.start(framework.depsForCommands, arbitraryActor(), {
        records: [record(memberNumber, 1)],
        removals: [],
        skipped: 0,
      })
    );
    expect(
      runner.start(framework.depsForCommands, arbitraryActor(), {
        records: [record(memberNumber, 2)],
        removals: [],
        skipped: 0,
      })
    ).toStrictEqual(E.left('already-running'));

    await untilDone(runner.current);

    expect(
      E.isRight(
        runner.start(framework.depsForCommands, arbitraryActor(), {
          records: [],
          removals: [],
          skipped: 0,
        })
      )
    ).toBe(true);
  });

});

describe('applyImportPlan retries a stale-version commit once', () => {
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

  const staleOnce = (): Dependencies => {
    let failed = false;
    const real = framework.depsForCommands;
    return {
      ...real,
      commitEvent: index => event => {
        if (!failed) {
          failed = true;
          return TE.left(
            failureWithStatus(
              'Resource has changes since the event to be committed was computed',
              StatusCodes.BAD_REQUEST
            )()
          );
        }
        return real.commitEvent(index)(event);
      },
    };
  };

  it('succeeds on the retry', async () => {
    const summary = await applyImportPlan(staleOnce(), arbitraryActor(), {
      records: [record(memberNumber, 1)],
      removals: [],
      skipped: 0,
    });
    expect(summary).toStrictEqual({recorded: 1, removed: 0, skipped: 0, failures: []});
  });

  it('reports a row that is stale twice', async () => {
    const alwaysStale: Dependencies = {
      ...framework.depsForCommands,
      commitEvent: () => () =>
        TE.left(
          failureWithStatus(
            'Resource has changes since the event to be committed was computed',
            StatusCodes.BAD_REQUEST
          )()
        ),
    };
    const summary = await applyImportPlan(alwaysStale, arbitraryActor(), {
      records: [record(memberNumber, 1)],
      removals: [],
      skipped: 0,
    });
    expect(summary.recorded).toStrictEqual(0);
    expect(summary.failures[0]).toContain('Resource has changes');
  });
});
