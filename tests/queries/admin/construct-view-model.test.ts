import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {constructViewModel} from '../../../src/queries/admin/construct-view-model';
import {admin} from '../../../src/queries/admin';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

// What the navbar's Owner page lists for somebody who looks after areas.
describe('the owner page', () => {
  let framework: TestFramework;
  const owner = arbitraryUser();
  const member = arbitraryUser();
  const woodShop = faker.string.uuid() as UUID;
  const metalShop = faker.string.uuid() as UUID;
  const bandSaw = faker.string.uuid() as UUID;
  const tableSaw = faker.string.uuid() as UUID;
  const oldPlaner = faker.string.uuid() as UUID;
  const lathe = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [owner, member]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    for (const [id, name] of [
      [woodShop, 'Wood Shop'],
      [metalShop, 'Metal Shop'],
    ] as const) {
      await framework.commands.area.create({id, name: name as NonEmptyString});
    }
    for (const [id, name, areaId] of [
      [bandSaw, 'Band Saw', woodShop],
      [tableSaw, 'Table Saw', woodShop],
      [oldPlaner, 'Planer', woodShop],
      [lathe, 'Lathe', metalShop],
    ] as const) {
      await framework.commands.equipment.add({
        id,
        name: name as NonEmptyString,
        areaId,
      });
    }
    await framework.commands.area.addOwner({
      areaId: woodShop,
      memberNumber: owner.memberNumber,
    });
    // Trains on the band saw and the planer here, and the lathe in an area
    // they do not own; not on the table saw.
    for (const equipmentId of [bandSaw, oldPlaner, lathe]) {
      await framework.commands.trainers.add({
        equipmentId,
        memberNumber: owner.memberNumber,
      });
    }
    await framework.commands.equipment.markObsolete({id: oldPlaner});
  });

  afterEach(() => {
    framework.close();
  });

  it('lists the areas they own, with the machines in each they train on', () => {
    const viewModel = constructViewModel(framework.depsForCommands, owner);

    expect(viewModel.isSuperUser).toBe(false);
    expect(viewModel.ownedAreas).toStrictEqual([
      {
        id: woodShop,
        name: 'Wood Shop',
        purchasingAreaId: O.none,
        trainerOn: [{id: bandSaw, name: 'Band Saw'}],
      },
    ]);
  });

  it('lets an owner in', async () => {
    const page = await admin(framework.depsForCommands)(owner, {}, {})();
    expect(E.isRight(page)).toBe(true);
  });

  it('turns away somebody who is neither an owner nor a super-user', async () => {
    const failure = getLeftOrFail(
      await admin(framework.depsForCommands)(member, {}, {})()
    );
    expect(failure.status).toStrictEqual(StatusCodes.FORBIDDEN);
  });
});
