import * as O from 'fp-ts/Option';
import {getDetails} from '../../../src/read-models/members/get';
import {EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';

describe('getDetails', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  it('returns none for non-existant members', async () => {
    const events = await framework.getAllEvents();
    const result = getDetails(9999)(events);
    expect(result).toStrictEqual(O.none);
  });

  it('returns member number and email', async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: 42,
      email: 'foo@example.com' as EmailAddress,
    });
    const events = await framework.getAllEvents();
    const result = getDetails(42)(events);
    expect(result).toEqual(
      O.some({
        memberNumber: 42,
        emailAddress: 'foo@example.com' as EmailAddress,
        gravatarHash:
          '321ba197033e81286fedb719d60d4ed5cecaed170733cb4a92013811afc0e3b6',
        name: O.none,
        pronouns: O.none,
        isSuperUser: false,
        prevEmails: [],
      })
    );
  });

  it('returns details', async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: 42,
      email: 'foo@example.com' as EmailAddress,
    });
    await framework.commands.members.editName({
      memberNumber: 42,
      name: 'Ford Prefect',
    });

    const events = await framework.getAllEvents();
    const result = getDetails(42)(events);
    expect(result).toEqual(
      O.some({
        memberNumber: 42,
        emailAddress: 'foo@example.com',
        gravatarHash:
          '321ba197033e81286fedb719d60d4ed5cecaed170733cb4a92013811afc0e3b6',
        name: O.some('Ford Prefect'),
        pronouns: O.none,
        isSuperUser: false,
        prevEmails: [],
      })
    );
  });

  it('returns latest details', async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: 42,
      email: 'foo@example.com' as EmailAddress,
    });
    await framework.commands.members.editName({
      memberNumber: 42,
      name: 'Ix',
    });
    await framework.commands.members.editPronouns({
      memberNumber: 42,
      pronouns: 'he/him',
    });
    await framework.commands.members.editName({
      memberNumber: 42,
      name: 'Ford Prefect',
    });

    const events = await framework.getAllEvents();
    const result = getDetails(42)(events);
    expect(result).toEqual(
      O.some({
        memberNumber: 42,
        emailAddress: 'foo@example.com',
        gravatarHash:
          '321ba197033e81286fedb719d60d4ed5cecaed170733cb4a92013811afc0e3b6',
        name: O.some('Ford Prefect'),
        pronouns: O.some('he/him'),
        isSuperUser: false,
        prevEmails: [],
      })
    );
  });

  it('returns latest email', async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: 42,
      email: 'foo@example.com' as EmailAddress,
    });
    await framework.commands.members.editEmail({
      memberNumber: 42,
      email: 'updated@example.com' as EmailAddress,
    });
    const events = await framework.getAllEvents();
    const result = getDetails(42)(events);
    expect(result).toEqual(
      O.some({
        memberNumber: 42,
        emailAddress: 'updated@example.com',
        gravatarHash:
          '916262ca7e4ee8a558858ea1c2d7674f7d2c8f3a06a0dfd1c5a68ef25e415022',
        name: O.none,
        pronouns: O.none,
        isSuperUser: false,
        prevEmails: ['foo@example.com'],
      })
    );
  });
});
