import {faker} from '@faker-js/faker';
import {constructEvent, DomainEvent} from '../../../src/types';
import {Actor} from '../../../src/types/actor';
import {arbitraryUser} from '../../types/user.helper';
import {UUID} from 'io-ts-types';
import {arbitraryActor} from '../../helpers';
import {markMemberTrainedBy} from '../../../src/commands/trainers/mark-member-trained-by';
import {DateTime} from 'luxon';
import { Int } from 'io-ts';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';

describe('markMemberTrainedBy authorization', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const equipmentId = faker.string.uuid() as UUID;
  const areaId = faker.string.uuid() as UUID;
  const trainerUser = arbitraryUser();
  const randomUser = arbitraryUser();
  const superUser = arbitraryUser();

  const makeInput = (trainedAt: Date) => ({
    equipmentId,
    trainedByMemberNumber: trainerUser.memberNumber as Int,
    trainedAt,
    memberNumber: faker.number.int() as Int,
  });

  const withinOneMonth = DateTime.now().minus({weeks: 1}).toJSDate();
  const moreThanOneMonthAgo = DateTime.now().minus({months: 1, days: 1}).toJSDate();
  const moreThan10YearsAgo = DateTime.now().minus({years: 10, days: 1}).toJSDate();
  const inTheFuture = DateTime.now().plus({days: 1}).toJSDate();

  const adminActor: Actor = {tag: 'token', token: 'admin'};
  const trainerActor: Actor = {tag: 'user', user: trainerUser};
  const randomActor: Actor = {tag: 'user', user: randomUser};
  const superUserActor: Actor = {tag: 'user', user: superUser};

  const baseEvents: DomainEvent[] = [
    constructEvent('AreaCreated')({
      name: 'Test Area',
      id: areaId,
      actor: arbitraryActor(),
    }),
    constructEvent('MemberNumberLinkedToEmail')({
      memberNumber: randomUser.memberNumber,
      email: randomUser.emailAddress,
      actor: arbitraryActor(),
      name: undefined,
      formOfAddress: undefined,
    }),
    constructEvent('EquipmentAdded')({
      name: 'Test Equipment',
      id: equipmentId,
      areaId,
      actor: arbitraryActor(),
    }),
    constructEvent('MemberNumberLinkedToEmail')({
      memberNumber: trainerUser.memberNumber,
      email: trainerUser.emailAddress,
      actor: arbitraryActor(),
      name: undefined,
      formOfAddress: undefined,
    }),
    constructEvent('OwnerAdded')({
      memberNumber: trainerUser.memberNumber,
      areaId,
      actor: arbitraryActor(),
    }),
    constructEvent('TrainerAdded')({
      memberNumber: trainerUser.memberNumber,
      equipmentId,
      actor: arbitraryActor(),
    }),
    constructEvent('MemberNumberLinkedToEmail')({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      actor: arbitraryActor(),
      name: undefined,
      formOfAddress: undefined,
    }),
    constructEvent('SuperUserDeclared')({
      memberNumber: superUser.memberNumber,
      actor: arbitraryActor(),
    })
  ];

  beforeEach(() => {
    baseEvents.forEach(framework.sharedReadModel.updateState);
  });

  it('super user can set date more than 10 years ago', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: superUserActor,
      rm: framework.sharedReadModel,
      input: makeInput(moreThan10YearsAgo),
    });
    expect(result).toBe(true);
  });

  it('token admin cannot use this endpoint', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: adminActor,
      rm: framework.sharedReadModel,
      input: makeInput(withinOneMonth),
    });
    expect(result).toBe(false);
  });

  it('trainer can set date within 1 month', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: trainerActor,
      rm: framework.sharedReadModel,
      input: makeInput(withinOneMonth),
    });
    expect(result).toBe(true);
  });

  it('trainer can set date more than 1 month ago', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: trainerActor,
      rm: framework.sharedReadModel,
      input: makeInput(moreThanOneMonthAgo),
    });
    expect(result).toBe(true);
  });

  it('trainer cannot set date more than 10 years ago', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: trainerActor,
      rm: framework.sharedReadModel,
      input: makeInput(moreThan10YearsAgo),
    });
    expect(result).toBe(false);
  });

  it('random user cannot mark member as trained', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: randomActor,
      rm: framework.sharedReadModel,
      input: makeInput(withinOneMonth),
    });
    expect(result).toBe(false);
  });

  it('trainer cannot claim training was done by someone else', () => {
    const otherTrainer = arbitraryUser();
    const result = markMemberTrainedBy.isAuthorized({
      actor: trainerActor,
      rm: framework.sharedReadModel,
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
      rm: framework.sharedReadModel,
      input: makeInput(inTheFuture),
    });
    expect(result).toBe(false);
  });

  it('super user cannot set date in the future', () => {
    const result = markMemberTrainedBy.isAuthorized({
      actor: superUserActor,
      rm: framework.sharedReadModel,
      input: makeInput(inTheFuture),
    });
    expect(result).toBe(false);
  });
});