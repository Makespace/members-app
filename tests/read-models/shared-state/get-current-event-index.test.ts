import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {TestFramework, initTestFramework} from '../test-framework';
import {arbitraryActor} from '../../helpers';
import {EmailAddress} from '../../../src/types';

describe('get-current-event-index', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  const arbitraryLinkNumberEvent = (memberNumber: Int, email: EmailAddress) => ({
    type: 'MemberNumberLinkedToEmail' as const,
    actor: arbitraryActor(),
    recordedAt: new Date(),
    memberNumber,
    email,
    name: undefined,
    formOfAddress: undefined,
  });

  it('returns 0 when no tracked events have been processed', () => {
    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(0);
  });

  it('returns the latest inserted tracked event index', () => {
    const firstEvent = framework.insertIntoSharedReadModel(
      arbitraryLinkNumberEvent(
        faker.number.int() as Int,
        faker.internet.email() as EmailAddress
      )
    );
    const secondEvent = framework.insertIntoSharedReadModel(
      arbitraryLinkNumberEvent(
        faker.number.int() as Int,
        faker.internet.email() as EmailAddress
      )
    );

    expect(firstEvent.event_index).toStrictEqual(1);
    expect(secondEvent.event_index).toStrictEqual(2);
    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(2);
  });
});
