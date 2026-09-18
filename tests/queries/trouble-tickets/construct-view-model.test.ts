import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {advanceTo, clear} from 'jest-date-mock';
import {arbitraryUser} from '../../types/user.helper';
import {constructViewModel} from '../../../src/queries/trouble-tickets/construct-view-model';
import * as T from 'fp-ts/Task';
import {getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const arbitraryTicket = (submittedAt: Date) => ({
  id: faker.string.uuid() as UUID,
  rowHash: faker.string.alphanumeric(64) as NonEmptyString,
  sheetId: faker.string.alphanumeric(10) as NonEmptyString,
  submittedAt,
  submittedMemberNumber: faker.number.int({min: 1}) as Int,
  submittedEmail: faker.internet.email(),
  submittedName: faker.person.fullName(),
  submittedEquipment: null,
  otherEquipmentDetail: '',
  status: 'Down',
  attempting: 'Cutting',
  issue: faker.lorem.sentence(),
  steps: '',
});

describe('construct-view-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
    clear();
  });

  const loggedInUser = arbitraryUser();
  const unregisteredUser = arbitraryUser();
  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: loggedInUser.memberNumber,
      email: loggedInUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
  });

  it('succeeds if the logged in user is a super user', async () => {
    await framework.commands.superUser.declare({
      memberNumber: loggedInUser.memberNumber,
    });

    const result = await pipe(
      loggedInUser,
      constructViewModel(framework.sharedReadModel),
      T.map(getRightOrFail)
    )();
    expect(result).toBeDefined();
  });

  it('shows tickets from the read model, windowed to the last 6 months', async () => {
    await framework.commands.superUser.declare({
      memberNumber: loggedInUser.memberNumber,
    });
    advanceTo(new Date('2026-06-01T00:00:00.000Z'));
    const recent = arbitraryTicket(new Date('2026-05-01T00:00:00.000Z'));
    const ancient = arbitraryTicket(new Date('2021-05-30T00:00:00.000Z'));
    await framework.commands.troubleTickets.record(recent);
    await framework.commands.troubleTickets.record(ancient);

    const result = await pipe(
      loggedInUser,
      constructViewModel(framework.sharedReadModel),
      T.map(getRightOrFail)
    )();

    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].id).toStrictEqual(recent.id);
  });

  it('fails if the logged in user is not a super user', async () => {
    const result = await pipe(
      loggedInUser,
      constructViewModel(framework.sharedReadModel)
    )();

    expect(result).toStrictEqual(E.left(expect.anything()));
  });

  it('fails if the user is unknown', async () => {
    const result = await pipe(
      unregisteredUser,
      constructViewModel(framework.sharedReadModel)
    )();

    expect(result).toStrictEqual(E.left(expect.anything()));
  });
});
