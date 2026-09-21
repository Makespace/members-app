import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {notifySiteNotifications} from '../../src/sync-worker/notify_site_notifications';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {arbitraryUser} from '../types/user.helper';

describe('notifySiteNotifications', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const owner = arbitraryUser();
  const nonOwner = arbitraryUser();

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const member of [owner, nonOwner]) {
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
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: owner.memberNumber,
    });
  });

  afterEach(() => framework.close());

  it('emails the audience once, converting markdown, and never re-sends', async () => {
    const notificationId = faker.string.uuid() as UUID;
    await framework.commands.notifications.create({
      id: notificationId,
      title: 'Owners forum' as NonEmptyString,
      message: '',
      bannerType: 'event',
      linkUrl: null,
      linkLabel: null,
      dismissable: true,
      expiresAt: null,
      targetAllOwners: true,
      targetAreaIds: [],
      emailMarkdown: 'Sign up [here](https://example.com/forum). **See you!**',
    });

    const sent: Array<{recipient: string; html: string}> = [];
    const deps = {
      ...framework.depsForCommands,
      conf: {PUBLIC_URL: 'http://localhost:8080'},
      sendEmail: (email: {recipient: string; html: string}) => () =>
        Promise.resolve(
          (sent.push({recipient: email.recipient, html: email.html}),
          {_tag: 'Right' as const, right: 'ok'})
        ),
    };

    await notifySiteNotifications(deps as never);

    expect(sent).toHaveLength(1);
    expect(sent[0].recipient).toBe(owner.emailAddress);
    expect(sent[0].html).toContain('href="https://example.com/forum"');
    expect(sent[0].html).toContain('<strong>See you!</strong>');

    await notifySiteNotifications(deps as never);
    expect(sent).toHaveLength(1);
    expect(
      framework.sharedReadModel.notifications.getById(notificationId)
        ?.emailSent
    ).toBe(true);
  });

  it('sends nothing for notifications without an email body', async () => {
    await framework.commands.notifications.create({
      id: faker.string.uuid() as UUID,
      title: 'Banner only' as NonEmptyString,
      message: '',
      bannerType: 'info',
      linkUrl: null,
      linkLabel: null,
      dismissable: true,
      expiresAt: null,
      targetAllOwners: true,
      targetAreaIds: [],
      emailMarkdown: null,
    });

    const sent: unknown[] = [];
    const deps = {
      ...framework.depsForCommands,
      conf: {PUBLIC_URL: 'http://localhost:8080'},
      sendEmail: () => () =>
        Promise.resolve((sent.push(1), {_tag: 'Right' as const, right: 'ok'})),
    };

    await notifySiteNotifications(deps as never);
    expect(sent).toHaveLength(0);
  });
});
