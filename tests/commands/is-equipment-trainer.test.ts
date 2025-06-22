import {faker} from '@faker-js/faker';
import {constructEvent, DomainEvent} from '../../src/types';
import {Actor} from '../../src/types/actor';
import {arbitraryUser} from '../types/user.helper';
import {UUID} from 'io-ts-types';
import {isEquipmentTrainer} from '../../src/commands/is-equipment-trainer';

describe('isEquipmentTrainer', () => {
  const userToBeSuperUser = arbitraryUser();
  const areaOwner = arbitraryUser();
  const areaOwner2 = arbitraryUser();
  const areaId = faker.string.uuid() as UUID;
  const areaId2 = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const equipmentId1_2 = faker.string.uuid() as UUID;
  const equipmentId2 = faker.string.uuid() as UUID;
  const trainerOnEquipment = arbitraryUser();
  const trainerOnEquipment1_2 = arbitraryUser();
  const trainerOnEquipment2 = arbitraryUser();

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
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber: userToBeSuperUser.memberNumber,
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
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber: userToBeSuperUser.memberNumber,
        }),
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
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
      false,
      {tag: 'user', user: areaOwner} satisfies Actor,
      [
        constructEvent('OwnerAdded')({
          memberNumber: areaOwner.memberNumber,
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
        }),
        constructEvent('EquipmentAdded')({
          name: 'equipment2',
          id: equipmentId2,
          areaId: areaId2,
        }),
        constructEvent('OwnerAdded')({
          memberNumber: areaOwner2.memberNumber,
          areaId: areaId2,
        }),
      ],
      equipmentId,
    ],
    [
      'trainer on equipment',
      true,
      {tag: 'user', user: trainerOnEquipment} satisfies Actor,
      [
        constructEvent('OwnerAdded')({
          memberNumber: trainerOnEquipment.memberNumber,
          areaId,
        }),
        constructEvent('TrainerAdded')({
          memberNumber: trainerOnEquipment.memberNumber,
          equipmentId,
        }),
      ],
      equipmentId,
    ],
    [
      'trainer on other equipment different area',
      false,
      {tag: 'user', user: trainerOnEquipment2} satisfies Actor,
      [
        constructEvent('AreaCreated')({
          name: 'area2',
          id: areaId2,
        }),
        constructEvent('EquipmentAdded')({
          name: 'equipment2',
          id: equipmentId2,
          areaId: areaId2,
        }),
        constructEvent('OwnerAdded')({
          memberNumber: trainerOnEquipment2.memberNumber,
          areaId: areaId2,
        }),
        constructEvent('TrainerAdded')({
          memberNumber: trainerOnEquipment2.memberNumber,
          equipmentId: equipmentId2,
        }),
      ],
      equipmentId,
    ],
    [
      'trainer on other equipment same area',
      false,
      {tag: 'user', user: trainerOnEquipment1_2} satisfies Actor,
      [
        constructEvent('EquipmentAdded')({
          name: 'equipment1_2',
          id: equipmentId1_2,
          areaId: areaId,
        }),
        constructEvent('OwnerAdded')({
          memberNumber: trainerOnEquipment1_2.memberNumber,
          areaId: areaId,
        }),
        constructEvent('TrainerAdded')({
          memberNumber: trainerOnEquipment1_2.memberNumber,
          equipmentId: equipmentId1_2,
        }),
      ],
      equipmentId,
    ],
  ])('%s: %s', (_, expected, actor, events: DomainEvent[], equipmentId) => {
    const eventsWithEquipment: DomainEvent[] = [
      constructEvent('AreaCreated')({
        name: 'area',
        id: areaId,
      }),
      constructEvent('EquipmentAdded')({
        name: 'equipment',
        id: equipmentId,
        areaId,
      }),
    ];
    expect(
      isEquipmentTrainer(equipmentId)(actor, eventsWithEquipment.concat(events))
    ).toBe(expected);
  });
});
