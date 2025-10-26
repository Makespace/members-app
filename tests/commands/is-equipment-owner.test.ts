import {faker} from '@faker-js/faker';
import {isEquipmentOwner} from '../../src/commands/is-equipment-owner';
import {constructEvent, DomainEvent} from '../../src/types';
import {Actor} from '../../src/types/actor';
import {arbitraryUser} from '../types/user.helper';
import {UUID} from 'io-ts-types';
import {arbitraryActor} from '../helpers';

describe('isEquipmentOwner', () => {
  const userToBeSuperUser = arbitraryUser();
  const areaOwner = arbitraryUser();
  const areaOwner2 = arbitraryUser();
  const areaId = faker.string.uuid() as UUID;
  const areaId2 = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const equipmentId2 = faker.string.uuid() as UUID;

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
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
        }),
      ],
      equipmentId,
    ],
    [
      'revoked super user',
      false,
      {tag: 'user', user: userToBeSuperUser} satisfies Actor,
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
        }),
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
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
        }),
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
      {tag: 'user', user: arbitraryUser()} satisfies Actor,
      [],
      equipmentId,
    ],
    [
      'area owner',
      true,
      {tag: 'user', user: areaOwner} satisfies Actor,
      [
        constructEvent('OwnerAdded')({
          memberNumber: areaOwner.memberNumber,
          actor: arbitraryActor(),
          areaId,
        }),
      ],
      equipmentId,
    ],
    [
      'area owner on different area',
      false,
      {tag: 'user', user: areaOwner2} satisfies Actor,
      [
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
      ],
      equipmentId,
    ],
  ])('%s: %s', (_, expected, actor, events: DomainEvent[], equipmentId) => {
    const eventsWithEquipment: DomainEvent[] = [
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
    ];
    expect(
      isEquipmentOwner(equipmentId)(actor, eventsWithEquipment.concat(events))
    ).toBe(expected);
  });
});
