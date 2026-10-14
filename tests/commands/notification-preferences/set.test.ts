import * as O from 'fp-ts/Option';
import {NonEmptyString, UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {
  canSetNotificationPreferences,
  setNotificationPreference,
} from '../../../src/commands/notification-preferences/set';
import {arbitraryUser} from '../../types/user.helper';
import {getTaskEitherRightOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {preferencesFor} from '../../../src/trouble-tickets/notification-preferences';
import {Actor} from '../../../src/types/actor';

describe('setting what somebody hears about', () => {
  let framework: TestFramework;
  const member = arbitraryUser();
  const other = arbitraryUser();
  const areaId = faker.string.uuid() as UUID;

  const asUser = (user: typeof member): Actor => ({
    tag: 'user',
    user: {memberNumber: user.memberNumber, emailAddress: user.emailAddress},
  });

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [member, other]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
  });
  afterEach(() => framework.close());

  const stored = () =>
    framework.sharedReadModel.notificationPreferences.forMember(
      member.memberNumber
    );

  it('remembers what somebody chose', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: member.memberNumber,
      scope: 'my-areas' as NonEmptyString,
      preference: 'daily',
    });
    expect(stored().get('my-areas')).toBe('daily');
  });

  // Following is the absence of a row, so changing back leaves nothing
  // behind rather than a row saying "nothing".
  it('forgets it again when they go back to following', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: member.memberNumber,
      scope: `area:${areaId}` as NonEmptyString,
      preference: 'live',
    });
    await framework.commands.notificationPreferences.set({
      memberNumber: member.memberNumber,
      scope: `area:${areaId}` as NonEmptyString,
      preference: 'follow',
    });
    expect(stored().has(`area:${areaId}`)).toBe(false);
  });

  // Saving a page of rules should not fill a member's history with the rows
  // they never touched.
  it('records nothing when the choice has not changed', async () => {
    const unchanged = await getTaskEitherRightOrFail(
      setNotificationPreference.process({
        command: {
          memberNumber: member.memberNumber,
          scope: 'my-areas' as NonEmptyString,
          preference: 'follow',
          actor: asUser(member),
        },
        rm: framework.sharedReadModel,
      })
    );
    expect(unchanged).toStrictEqual(O.none);
  });

  it('what somebody chose beats the default for that scope', async () => {
    const before = preferencesFor(
      {ownerOf: [], trainerFor: []},
      [],
      [],
      stored()
    );
    expect(before[1]?.effective).toBe('weekly');

    await framework.commands.notificationPreferences.set({
      memberNumber: member.memberNumber,
      scope: 'my-areas' as NonEmptyString,
      preference: 'live',
    });

    const after = preferencesFor(
      {ownerOf: [], trainerFor: []},
      [],
      [],
      stored()
    );
    expect(after[1]?.effective).toBe('live');
  });

  describe('who may set it', () => {
    const can = (actor: Actor, memberNumber: number) =>
      canSetNotificationPreferences({
        actor,
        rm: framework.sharedReadModel,
        input: {memberNumber},
      });

    it('lets somebody set their own', () => {
      expect(can(asUser(member), member.memberNumber)).toBe(true);
    });

    it("does not let one member set another member's", () => {
      expect(can(asUser(other), member.memberNumber)).toBe(false);
    });

    // Which is also how the system sets it when a role change makes a
    // machine somebody's responsibility.
    it('lets an admin set somebody else', () => {
      expect(can({tag: 'token', token: 'admin'}, member.memberNumber)).toBe(
        true
      );
    });
  });
});
