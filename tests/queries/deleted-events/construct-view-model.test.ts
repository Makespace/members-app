import {constructViewModel} from '../../../src/queries/deleted-events/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {arbitraryActor, getLeftOrFail, getTaskEitherRightOrFail, userActor} from '../../helpers';
import {StatusCodes} from 'http-status-codes';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import { faker } from '@faker-js/faker';
import { Int } from 'io-ts';
import { constructEvent } from '../../../src/types';
import { UUID } from 'io-ts-types';

describe('deleted-events construct-view-model', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the user has not been declared to be a super user', () => {
    const user = arbitraryUser();

    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    });

    it('does not show deleted events', async () => {
      const failure = getLeftOrFail(
        await constructViewModel(
          framework.depsForCommands, user
        )()
      );
      expect(failure.status).toStrictEqual(StatusCodes.FORBIDDEN);
    });
  });

  it('shows deleted events to super users', async () => {
    const superUser = arbitraryUser();

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });

    // Commit event index 3.
    framework.depsForCommands.commitEvent(2 as Int)(
      constructEvent('AreaCreated')({
        id: faker.string.uuid() as UUID,
        name: faker.animal.dog(),
        actor: arbitraryActor(),
      })
    );

    framework.depsForCommands.deleteEvent(3 as Int, faker.lorem.sentence(), faker.number.int() as Int);

    const result = await getTaskEitherRightOrFail(
      constructViewModel(framework.depsForCommands, superUser)
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0].event_index).toStrictEqual(3);
    expect(result.events[0].type).toStrictEqual('AreaCreated');
    expect(result.events[0].deletedAt).toEqual(expect.any(Date));
  });
});
