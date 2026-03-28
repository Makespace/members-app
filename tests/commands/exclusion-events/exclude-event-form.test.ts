import * as O from 'fp-ts/Option';
import {StatusCodes} from 'http-status-codes';
import {excludeEventForm} from '../../../src/commands/exclusion-events/exclude-event-form';
import {getEventById} from '../../../src/init-dependencies/event-store/get-all-events';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {arbitraryUser} from '../../types/user.helper';
import { FormDependencies } from '../../../src/types/form';
import { faker } from '@faker-js/faker';

describe('exclude event form', () => {
  let framework: TestFramework;
  let deps: FormDependencies;

  beforeEach(async () => {
    framework = await initTestFramework();
    deps = {
      getEventById: getEventById(framework.eventStoreDb),
    };
  });

  afterEach(() => {
    framework.close();
  });

  it('constructs a view model containing the selected event', async () => {
    await framework.commands.superUser.declare({
      memberNumber: 1234,
    });
    const [event] = await framework.getAllEvents();
    const result = getRightOrFail(
      await excludeEventForm.constructForm({event_id: event.event_id})({
        user: arbitraryUser(),
        readModel: framework.sharedReadModel,
        deps,
      })()
    );

    expect(result).toStrictEqual({
      event: O.some(event),
    });
  });

  it('constructs a view model with no event when the event cannot be found', async () => {
    const result = getRightOrFail(
      await excludeEventForm.constructForm({
        event_id: faker.string.uuid(),
      })({
        user: arbitraryUser(),
        readModel: framework.sharedReadModel,
        deps,
      })()
    );

    expect(result).toStrictEqual({
      event: O.none,
    });
  });

  it('returns a bad request failure when the submitted event id is invalid', async () => {
    const result = getLeftOrFail(
      await excludeEventForm.constructForm({event_id: 'not-a-uuid'})({
        user: arbitraryUser(),
        readModel: framework.sharedReadModel,
        deps,
      })()
    );

    expect(result).toMatchObject({
      status: StatusCodes.BAD_REQUEST,
      message: 'Parameters submitted to the form were invalid',
    });
  });
});
