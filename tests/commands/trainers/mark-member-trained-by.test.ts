import {faker} from '@faker-js/faker';
import {constructEvent, DomainEvent} from '../../../src/types';
import {Actor} from '../../../src/types/actor';
import {arbitraryUser} from '../../types/user.helper';
import {Int, UUID} from 'io-ts-types';
import {arbitraryActor} from '../../helpers';
import {markMemberTrainedBy} from '../../../src/commands/trainers/mark-member-trained-by';
import {DateTime} from 'luxon';

describe('markMemberTrainedBy authorization', () => {
  const equipmentId = faker.string.uuid() as UUID;
  const areaId = faker.string.uuid() as UUID;
  const trainerUser = arbitraryUser();
  const randomUser = arbitraryUser();

  const baseEvents: DomainEvent[] = [
    constructEvent('AreaCreated')({
      name: 'Test Area',
      id: areaId,
      actor: arbitraryActor(),
    }),
    constructEvent('EquipmentAdded')({
      name: 'Test Equipment',
      id: equipmentId,
      areaId,
      actor: arbitraryActor(),
    }),
    constructEvent('TrainerAdded')({
      memberNumber: trainerUser.memberNumber,
      equipmentId,
      actor: arbitraryActor(),
    }),
  ];

  const makeInput = (trainedAt: Date) => ({
    equipmentId,
    trainedByMemberNumber: trainerUser.memberNumber as Int,
    trainedAt,
    memberNumber: faker.number.int() as Int,
  });

  const withinOneMonth = DateTime.now().minus({weeks: 1}).toJSDate();
  const moreThanOneMonthAgo = DateTime.now().minus({months: 1, days: 1}).toJSDate();
  const inTheFuture = DateTime.now().plus({days: 1}).toJSDate();

  const adminActor: Actor = {tag: 'token', token: 'admin'};
  const trainerActor: Actor = {tag: 'user', user: trainerUser};
  const randomActor: Actor = {tag: 'user', user: randomUser};

  it('super user can set date more than 1 month ago', () => {
    const superUser = arbitraryUser();
    const superUserActor: Actor = {tag: 'user', user: superUser};
    const eventsWithSuperUser = [
      ...baseEvents,
      constructEvent('SuperUserDeclared')({
        memberNumber: superUser.memberNumber,
        actor: arbitraryActor(),
      }),
    ];
    const result = markMemberTrainedBy.isAuthorized({
      actor: superUserActor,
      events: eventsWithSuperUser,
      input: makeInput(moreThanOneMonthAgo),
    });
    expect(result).toBe(true);
  });

  it('token admin cannot use this endpoint', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: adminActor,
      events: baseEvents,
      input: makeInput(withinOneMonth),
    });
    expect(result).toBe(false);
  });

  it('trainer can set date within 1 month', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: trainerActor,
      events: baseEvents,
      input: makeInput(withinOneMonth),
    });
    expect(result).toBe(true);
  });

  it('trainer cannot set date more than 1 month ago', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: trainerActor,
      events: baseEvents,
      input: makeInput(moreThanOneMonthAgo),
    });
    expect(result).toBe(false);
  });

  it('random user cannot mark member as trained', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: randomActor,
      events: baseEvents,
      input: makeInput(withinOneMonth),
    });
    expect(result).toBe(false);
  });

  it('trainer cannot claim training was done by someone else', () => {
    const otherTrainer = arbitraryUser();
    const result = markMemberTrainedBy.isAuthorized({
      actor: trainerActor,
      events: baseEvents,
      input: {
        ...makeInput(withinOneMonth),
        trainedByMemberNumber: otherTrainer.memberNumber as Int,
      },
    });
    expect(result).toBe(false);
  });

  it('trainer cannot set date in the future', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: trainerActor,
      events: baseEvents,
      input: makeInput(inTheFuture),
    });
    expect(result).toBe(false);
  });

  it('super user cannot set date in the future', () => {
    const superUser = arbitraryUser();
    const superUserActor: Actor = {tag: 'user', user: superUser};
    const eventsWithSuperUser = [
      ...baseEvents,
      constructEvent('SuperUserDeclared')({
        memberNumber: superUser.memberNumber,
        actor: arbitraryActor(),
      }),
    ];
    const result = markMemberTrainedBy.isAuthorized({
      actor: superUserActor,
      events: eventsWithSuperUser,
      input: makeInput(inTheFuture),
    });
    expect(result).toBe(false);
  });
});