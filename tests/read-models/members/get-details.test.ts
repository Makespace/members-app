import * as O from 'fp-ts/Option';
import {getDetails} from '../../../src/read-models/members/get-details';
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
        email: 'foo@example.com' as EmailAddress,
        name: O.none,
        pronouns: O.none,
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
        email: 'foo@example.com',
        name: O.some('Ford Prefect'),
        pronouns: O.none,
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
        email: 'foo@example.com',
        name: O.some('Ford Prefect'),
        pronouns: O.some('he/him'),
      })
    );
  });
});
