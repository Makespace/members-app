import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Int} from 'io-ts';
import {pipe} from 'fp-ts/lib/function';
import * as T from 'fp-ts/Task';
import {commands} from '../../../src/commands';
import {getRightOrFail} from '../../helpers';
import {arbitraryUser} from '../../types/user.helper';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// Moving a machine off red hides its training machinery but keeps every
// record, and the form is where somebody about to do it finds that out.
describe('the sticker category form', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const user = arbitraryUser();
  const trainee = arbitraryUser();

  const formHtml = async (): Promise<string> => {
    const viewModel = getRightOrFail(
      await pipe(
        commands.equipment.setCategory.constructForm({equipmentId})({
          user,
          deps: framework.depsForCommands,
          readModel: framework.sharedReadModel,
        }),
        T.map(result => result)
      )()
    );
    return commands.equipment.setCategory
      .renderForm(viewModel)
      .body.replace(/\s+/g, ' ');
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const member of [user, trainee]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: member.memberNumber,
        email: member.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
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

  it('offers all three colours, with the current one selected', async () => {
    const form = await formHtml();

    for (const category of ['red', 'orange', 'green']) {
      expect(form).toContain(`value="${category}"`);
    }
    expect(form).toMatch(/value="red" checked/);
  });

  it('says nothing about training when there is none on record', async () => {
    expect(await formHtml()).not.toContain('trained member');
  });

  it('says what happens to the training records, when there are some', async () => {
    await framework.commands.trainers.markTrained({
      equipmentId,
      memberNumber: trainee.memberNumber as Int,
    });

    const form = await formHtml();

    expect(form).toContain('1 trained member');
    expect(form).toContain('keeps all of that');
    expect(form).toContain('Set it back to red and it all reappears');
  });

  // The records themselves: still there after the colour changes, which is
  // the promise the form makes.
  it('keeps the training records when the colour changes', async () => {
    await framework.commands.trainers.markTrained({
      equipmentId,
      memberNumber: trainee.memberNumber as Int,
    });

    await framework.commands.equipment.setCategory({
      equipmentId,
      category: 'orange',
    });

    const equipment = framework.sharedReadModel.equipment.get(equipmentId);
    expect(equipment).toMatchObject({
      value: {category: 'orange'},
    });
    expect(
      equipment._tag === 'Some' ? equipment.value.trainedMembers.length : 0
    ).toBe(1);
  });
});
