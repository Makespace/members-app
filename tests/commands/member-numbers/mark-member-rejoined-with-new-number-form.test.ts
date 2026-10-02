import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {markMemberRejoinedWithNewNumberForm} from '../../../src/commands/member-numbers/mark-member-rejoined-with-new-number-form';
import {EmailAddress} from '../../../src/types';
import {getRightOrFail} from '../../helpers';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';
import {arbitraryUser} from '../../types/user.helper';

describe('mark member rejoined with new number form', () => {
  let framework: TestFramework;
  const oldMemberNumber = faker.number.int({max: 100000}) as Int;
  const newMemberNumber = faker.number.int({
    min: oldMemberNumber + 1,
    max: 200000,
  }) as Int;

  const construct = async (input: unknown) =>
    getRightOrFail(
      await markMemberRejoinedWithNewNumberForm.constructForm(input)({
        user: arbitraryUser(),
        deps: framework.depsForCommands,
        readModel: framework.sharedReadModel,
      })()
    );

  const addMember = (memberNumber: number) =>
    framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: faker.person.fullName(),
      formOfAddress: undefined,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('asks for the two numbers when given none', async () => {
    expect(await construct({})).toStrictEqual({
      step: 'pick-numbers',
      error: O.none,
    });
  });

  it('explains when the old number is unknown', async () => {
    const viewModel = await construct({
      oldMemberNumber: String(oldMemberNumber),
      newMemberNumber: String(newMemberNumber),
    });
    expect(viewModel.step).toStrictEqual('pick-numbers');
    expect(viewModel).toHaveProperty(
      'error',
      O.some(`No member with number ${oldMemberNumber} is known to the app`)
    );
  });

  it('refuses numbers in the wrong order', async () => {
    await addMember(oldMemberNumber);
    const viewModel = await construct({
      oldMemberNumber: String(newMemberNumber),
      newMemberNumber: String(oldMemberNumber),
    });
    expect(viewModel.step).toStrictEqual('pick-numbers');
    expect(viewModel).toHaveProperty(
      'error',
      O.some('The old number must be lower than the new number')
    );
  });

  it("shows the old record's training so the admin can decide", async () => {
    const area = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const equipment = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: area.id,
    };
    await framework.commands.area.create(area);
    await framework.commands.equipment.add(equipment);
    await addMember(oldMemberNumber);
    await framework.commands.trainers.markTrained({
      equipmentId: equipment.id,
      memberNumber: oldMemberNumber,
    });

    const viewModel = await construct({
      oldMemberNumber: String(oldMemberNumber),
      newMemberNumber: String(newMemberNumber),
    });

    expect(viewModel).toMatchObject({
      step: 'confirm',
      oldMemberNumber,
      newMemberNumber,
      alreadyLinked: false,
      newRecord: O.none,
    });
    expect(viewModel).toHaveProperty(
      'oldRecord.trainedOn',
      expect.arrayContaining([expect.objectContaining({id: equipment.id})])
    );
    // No Recurly data in tests, so the reason reflects that rather than guessing.
    expect(viewModel).toHaveProperty('oldRecord.recurlyReasons', ['no-data']);
  });

  it('summarises both records when the new number is already registered', async () => {
    await addMember(oldMemberNumber);
    await addMember(newMemberNumber);

    const viewModel = await construct({
      oldMemberNumber: String(oldMemberNumber),
      newMemberNumber: String(newMemberNumber),
    });

    expect(viewModel).toMatchObject({step: 'confirm', alreadyLinked: false});
    expect(viewModel).toHaveProperty('newRecord', O.some(expect.objectContaining({
      memberNumber: newMemberNumber,
    })));
  });

  it('says so when the numbers already belong to the same member', async () => {
    await addMember(oldMemberNumber);
    await addMember(newMemberNumber);
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
      carryOverTraining: true,
    });

    const viewModel = await construct({
      oldMemberNumber: String(oldMemberNumber),
      newMemberNumber: String(newMemberNumber),
    });

    expect(viewModel).toMatchObject({step: 'confirm', alreadyLinked: true});
  });
});
