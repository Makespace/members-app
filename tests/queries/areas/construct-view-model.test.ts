import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import {constructViewModel} from '../../../src/queries/areas/construct-view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';

describe('construct-view-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const unregisteredUser = arbitraryUser();
  const unprivilegedUser = arbitraryUser();
  const superUser = arbitraryUser();
  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: unprivilegedUser.memberNumber,
      email: unprivilegedUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
  });

  it('succeeds if the logged in user is a super user', async () => {
    const result = await pipe(
      superUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();
    expect(result.myAreas).toBeDefined();
    expect(result.makespaceAreas).toBeDefined();
    expect(result.systems).toBeDefined();
    expect(result.canManageAreas).toStrictEqual(true);
    expect(result.canSeeOwnerPrivateDetails).toStrictEqual(true);
  });

  it('succeeds if the logged in user is not a super user', async () => {
    const result = await pipe(
      unprivilegedUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();
    expect(result.myAreas).toBeDefined();
    expect(result.makespaceAreas).toBeDefined();
    expect(result.systems).toBeDefined();
    expect(result.canManageAreas).toStrictEqual(false);
    expect(result.canSeeOwnerPrivateDetails).toStrictEqual(false);
  });

  it('partitions areas into owned, makespace, and systems', async () => {
    const ownedId = faker.string.uuid() as UUID;
    const systemId = faker.string.uuid() as UUID;
    const otherId = faker.string.uuid() as UUID;
    await framework.commands.area.create({
      id: ownedId,
      name: 'My Workshop' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: systemId,
      name: 'Events' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: otherId,
      name: 'Wood Room' as NonEmptyString,
    });
    await framework.commands.area.addOwner({
      areaId: ownedId,
      memberNumber: superUser.memberNumber,
    });

    const result = await pipe(
      superUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();

    expect(result.myAreas.map(area => area.id)).toStrictEqual([ownedId]);
    expect(result.systems.map(area => area.name)).toContain('Events');
    expect(result.makespaceAreas.map(area => area.id)).toContain(otherId);
    expect(result.makespaceAreas.map(area => area.id)).not.toContain(ownedId);
  });

  it("fails if the logged in user isn't known to the shared state", async () => {
    const result = await pipe(
      unregisteredUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getLeftOrFail)
    )();
    expect(result.status).toStrictEqual(401);
  });
});
