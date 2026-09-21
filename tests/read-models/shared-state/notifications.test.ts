import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {TestFramework, initTestFramework} from '../test-framework';
import {arbitraryUser} from '../../types/user.helper';
import {getSomeOrFail} from '../../helpers';

const arbitraryNotification = (over: Record<string, unknown> = {}) => ({
  id: faker.string.uuid() as UUID,
  title: faker.lorem.sentence(3) as NonEmptyString,
  message: faker.lorem.sentence(),
  bannerType: 'event' as const,
  linkUrl: null,
  linkLabel: null,
  dismissable: true,
  expiresAt: null,
  targetAllOwners: true,
  targetAreaIds: [] as ReadonlyArray<string>,
  emailMarkdown: null,
  ...over,
});

describe('notifications read model', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const otherAreaId = faker.string.uuid() as UUID;
  const owner = arbitraryUser();
  const otherOwner = arbitraryUser();
  const nonOwner = arbitraryUser();

  const memberOf = (user: typeof owner) =>
    getSomeOrFail(
      framework.sharedReadModel.members.getByMemberNumber(user.memberNumber)
    );

  const visibleTo = (user: typeof owner) =>
    framework.sharedReadModel.notifications.getForMember(
      memberOf(user),
      new Date()
    );

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const member of [owner, otherOwner, nonOwner]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: member.memberNumber,
        email: member.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: otherAreaId,
      name: 'Laser Cutters' as NonEmptyString,
    });
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: owner.memberNumber,
    });
    await framework.commands.area.addOwner({
      areaId: otherAreaId,
      memberNumber: otherOwner.memberNumber,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('shows an all-owners notification to owners but not members', async () => {
    await framework.commands.notifications.create(arbitraryNotification());

    expect(visibleTo(owner)).toHaveLength(1);
    expect(visibleTo(otherOwner)).toHaveLength(1);
    expect(visibleTo(nonOwner)).toHaveLength(0);
  });

  it('area-targeted notifications reach only those areas’ owners', async () => {
    await framework.commands.notifications.create(
      arbitraryNotification({
        targetAllOwners: false,
        targetAreaIds: [areaId],
      })
    );

    expect(visibleTo(owner)).toHaveLength(1);
    expect(visibleTo(otherOwner)).toHaveLength(0);
  });

  it('expired and revoked notifications disappear', async () => {
    const expired = arbitraryNotification({
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    const revoked = arbitraryNotification();
    await framework.commands.notifications.create(expired);
    await framework.commands.notifications.create(revoked);
    await framework.commands.notifications.revoke({
      notificationId: revoked.id,
    });

    expect(visibleTo(owner)).toHaveLength(0);
  });

  it('a dismissal hides the notification for that member only', async () => {
    const notification = arbitraryNotification();
    await framework.commands.notifications.create(notification);
    await framework.commands.notifications.dismiss({
      notificationId: notification.id,
      actor: {
        tag: 'user',
        user: {
          emailAddress: owner.emailAddress,
          memberNumber: owner.memberNumber,
        },
      },
    });

    expect(visibleTo(owner)).toHaveLength(0);
    expect(visibleTo(otherOwner)).toHaveLength(1);
  });

  it('refuses to dismiss a non-dismissable notification', async () => {
    const notification = arbitraryNotification({dismissable: false});
    await framework.commands.notifications.create(notification);

    await expect(
      framework.commands.notifications.dismiss({
        notificationId: notification.id,
        actor: {
          tag: 'user',
          user: {
            emailAddress: owner.emailAddress,
            memberNumber: owner.memberNumber,
          },
        },
      })
    ).rejects.toThrow();
    expect(visibleTo(owner)).toHaveLength(1);
  });

  it('stores link and email fields', async () => {
    const notification = arbitraryNotification({
      linkUrl: 'https://www.meetup.com/makespace/events/316647091/',
      linkLabel: 'Sign up',
      emailMarkdown: 'See you at the **forum**!',
    });
    await framework.commands.notifications.create(notification);

    const stored = framework.sharedReadModel.notifications.getById(
      notification.id
    );
    expect(stored).toMatchObject({
      linkUrl: 'https://www.meetup.com/makespace/events/316647091/',
      linkLabel: 'Sign up',
      emailMarkdown: 'See you at the **forum**!',
      emailSent: false,
    });
    expect(O.isSome(O.fromNullable(stored))).toBe(true);
  });
});
