import {faker} from '@faker-js/faker';
import {constructEvent, DomainEvent} from '../../../src/types';
import {Actor} from '../../../src/types/actor';
import {arbitraryUser} from '../../types/user.helper';
import {UUID} from 'io-ts-types';
import {arbitraryActor} from '../../helpers';
import { isEquipmentOwner } from '../../../src/commands/authentication-helpers/is-equipment-owner';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';

describe('isEquipmentOwner', () => {
  const userToBeSuperUser = arbitraryUser();
  const areaOwner = arbitraryUser();
  const areaOwner2 = arbitraryUser();
  const randomUser = arbitraryUser();
  const areaId = faker.string.uuid() as UUID;
  const areaId2 = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const equipmentId2 = faker.string.uuid() as UUID;

  const baseEvents = [
    constructEvent('AreaCreated')({
      name: 'area',
      id: areaId,
      actor: arbitraryActor(),
    }),
    constructEvent('EquipmentAdded')({
      name: 'equipment',
      id: equipmentId,
      areaId,
      actor: arbitraryActor(),
    }),
    constructEvent('AreaCreated')({
      name: 'area',
      id: areaId2,
      actor: arbitraryActor(),
    }),
    constructEvent('EquipmentAdded')({
      name: 'equipment',
      id: equipmentId2,
      areaId: areaId2,
      actor: arbitraryActor(),
    }),
    constructEvent('MemberNumberLinkedToEmail')({
      memberNumber: userToBeSuperUser.memberNumber,
      email: userToBeSuperUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
      actor: arbitraryActor()
    }),
    constructEvent('SuperUserDeclared')({
      memberNumber: userToBeSuperUser.memberNumber,
      actor: arbitraryActor(),
    }),
    constructEvent('MemberNumberLinkedToEmail')({
      memberNumber: areaOwner.memberNumber,
      email: areaOwner.emailAddress,
      name: undefined,
      formOfAddress: undefined,
      actor: arbitraryActor()
    }),
    constructEvent('OwnerAdded')({
      memberNumber: areaOwner.memberNumber,
      actor: arbitraryActor(),
      areaId,
    }),
    constructEvent('MemberNumberLinkedToEmail')({
      memberNumber: areaOwner2.memberNumber,
      email: areaOwner2.emailAddress,
      name: undefined,
      formOfAddress: undefined,
      actor: arbitraryActor()
    }),
    constructEvent('AreaCreated')({
      name: 'area2',
      id: areaId2,
      actor: arbitraryActor(),
    }),
    constructEvent('EquipmentAdded')({
      name: 'equipment2',
      id: equipmentId2,
      areaId: areaId2,
      actor: arbitraryActor(),
    }),
    constructEvent('OwnerAdded')({
      memberNumber: areaOwner2.memberNumber,
      areaId: areaId2,
      actor: arbitraryActor(),
    }),
    constructEvent('MemberNumberLinkedToEmail')({
      memberNumber: randomUser.memberNumber,
      email: randomUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
      actor: arbitraryActor()
    })
  ];

  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
    baseEvents.forEach(framework.sharedReadModel.updateState);
  });
  afterEach(() => {
    framework.close();
  });

  it.each([
    [
      'admin via token',
      false,
      {tag: 'token', token: 'admin'} satisfies Actor,
      [],
      equipmentId,
    ],
    [
      'super user',
      false,
      {tag: 'user', user: userToBeSuperUser} satisfies Actor,
      [],
      equipmentId,
    ],
    [
      'revoked super user',
      false,
      {tag: 'user', user: userToBeSuperUser} satisfies Actor,
      [
        constructEvent('SuperUserRevoked')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
        }),
      ],
      equipmentId,
    ],
    [
      'reinstated super user',
      false,
      {tag: 'user', user: userToBeSuperUser} satisfies Actor,
      [
        constructEvent('SuperUserRevoked')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
        }),
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
        }),
      ],
      equipmentId,
    ],
    [
      'other user',
      false,
      {tag: 'user', user: randomUser} satisfies Actor,
      [],
      equipmentId,
    ],
    [
      'area owner',
      true,
      {tag: 'user', user: areaOwner} satisfies Actor,
      [],
      equipmentId,
    ],
    [
      'area owner on different area',
      false,
      {tag: 'user', user: areaOwner2} satisfies Actor,
      [],
      equipmentId,
    ],
  ])('%s: %s', (_, expected, actor, events: DomainEvent[], equipmentId) => {
    events.forEach(framework.sharedReadModel.updateState);
    expect(
      isEquipmentOwner({
        actor,
        rm: framework.sharedReadModel,
        input: {equipmentId}
      })
    ).toBe(expected);
  });
});
