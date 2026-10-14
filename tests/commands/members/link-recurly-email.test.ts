import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {sql} from 'drizzle-orm';
import {linkRecurlyEmail} from '../../../src/commands/members/link-recurly-email';
import {linkRecurlyEmailForm} from '../../../src/commands/members/link-recurly-email-form';
import {EmailAddress} from '../../../src/types';
import {
  arbitraryActor,
  getLeftOrFail,
  getRightOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
  insertRecurlySubscription,
  userActor,
} from '../../helpers';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';
import {arbitraryUser} from '../../types/user.helper';

describe('link-recurly-email', () => {
  let framework: TestFramework;
  const memberNumber = faker.number.int({min: 1, max: 100_000});
  const otherMemberNumber = memberNumber + 1;
  const billing = 'billing@example.com' as EmailAddress;

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const number of [memberNumber, otherMemberNumber]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: number,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.members.editName({memberNumber, name: 'Molly Millions'});
    await insertRecurlySubscription(framework.extDB, {
      email: billing,
      hasActiveSubscription: true,
      accountCode: 'signup@example.com',
    });
    // The sync fills the name in; the form shows it.
    await framework.extDB.run(
      sql`UPDATE recurly_account_codes SET name = 'Molly Millions' WHERE code = 'signup@example.com'`
    );
  });

  afterEach(() => {
    framework.close();
  });

  const run = (input: {memberNumber: number; email: EmailAddress}) =>
    linkRecurlyEmail.process({
      command: {...input, actor: arbitraryActor()},
      rm: framework.sharedReadModel,
      deps: framework.depsForCommands,
    })();

  it('raises MemberEmailLinkedByAdmin for a billing address Recurly holds', async () => {
    const event = getSomeOrFail(
      await getTaskEitherRightOrFail(() => run({memberNumber, email: billing}))
    );
    expect(event).toMatchObject({type: 'MemberEmailLinkedByAdmin', memberNumber, email: billing});
  });

  it('accepts an account code too', async () => {
    const event = getSomeOrFail(
      await getTaskEitherRightOrFail(() =>
        run({memberNumber, email: 'signup@example.com' as EmailAddress})
      )
    );
    expect(event).toMatchObject({type: 'MemberEmailLinkedByAdmin'});
  });

  it('refuses an address Recurly does not hold', async () => {
    const failure = getLeftOrFail(
      await run({memberNumber, email: 'stranger@example.com' as EmailAddress})
    );
    expect(failure.status).toBe(StatusCodes.BAD_REQUEST);
    expect(failure.message).toContain('Recurly has no account');
  });

  it('refuses an address that belongs to another member', async () => {
    await framework.commands.members.addEmail({memberNumber: otherMemberNumber, email: billing});
    const failure = getLeftOrFail(await run({memberNumber, email: billing}));
    expect(failure.status).toBe(StatusCodes.BAD_REQUEST);
    expect(failure.message).toContain('another member');
  });

  it('fails for an unknown member', async () => {
    const failure = getLeftOrFail(await run({memberNumber: memberNumber + 50, email: billing}));
    expect(failure.status).toBe(StatusCodes.NOT_FOUND);
  });

  it('does nothing when the member already verified the address themselves', async () => {
    await framework.commands.members.addEmail({memberNumber, email: billing});
    await framework.commands.members.verifyEmail({memberNumber, emailAddress: billing});
    expect(await getTaskEitherRightOrFail(() => run({memberNumber, email: billing}))).toStrictEqual(O.none);
  });

  it('still links an address the member added but never verified', async () => {
    await framework.commands.members.addEmail({memberNumber, email: billing});
    const event = getSomeOrFail(
      await getTaskEitherRightOrFail(() => run({memberNumber, email: billing}))
    );
    expect(event).toMatchObject({type: 'MemberEmailLinkedByAdmin'});
  });

  it('is for super users and the admin token only', () => {
    const check = (actor: Parameters<typeof linkRecurlyEmail.isAuthorized>[0]['actor']) =>
      linkRecurlyEmail.isAuthorized({actor, rm: framework.sharedReadModel, input: {memberNumber, email: billing}});
    expect(check(arbitraryActor())).toBe(true);
    const self = userActor();
    expect(check({...self, user: {...self.user, memberNumber}})).toBe(false);
  });

  it('refuses an address another member holds in a different case', async () => {
    await framework.commands.members.addEmail({
      memberNumber: otherMemberNumber,
      email: 'Billing@example.com' as EmailAddress,
    });
    const failure = getLeftOrFail(await run({memberNumber, email: billing}));
    expect(failure.message).toContain('another member');
  });

  it('links the spelling the member already has rather than adding another', async () => {
    const theirs = 'Billing@example.com' as EmailAddress;
    await framework.commands.members.addEmail({memberNumber, email: theirs});
    const event = getSomeOrFail(
      await getTaskEitherRightOrFail(() => run({memberNumber, email: billing}))
    );
    expect(event).toMatchObject({email: theirs});
  });

  describe('the confirm form', () => {
    const build = (member: number, email: string) =>
      linkRecurlyEmailForm.constructForm({member: String(member), email})({
        user: arbitraryUser(),
        deps: framework.depsForCommands,
        readModel: framework.sharedReadModel,
      })();

    it('shows the member and the name on the Recurly account', async () => {
      const viewModel = getRightOrFail(await build(memberNumber, billing));
      expect(viewModel).toMatchObject({
        memberNumber,
        memberName: O.some('Molly Millions'),
        email: billing,
        recurlyName: O.some('Molly Millions'),
      });
    });

    it('finds the Recurly name through the account code as well', async () => {
      const viewModel = getRightOrFail(await build(memberNumber, 'signup@example.com'));
      expect(viewModel.recurlyName).toStrictEqual(O.some('Molly Millions'));
    });

    it('is not found for an unknown member', async () => {
      const failure = getLeftOrFail(await build(memberNumber + 50, billing));
      expect(failure.status).toBe(StatusCodes.NOT_FOUND);
    });
  });
});
