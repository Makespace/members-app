import * as O from 'fp-ts/Option';
import {StatusCodes} from 'http-status-codes';
import {
  LinkNumberToEmail,
  linkNumberToEmail,
} from '../../../src/commands/member-numbers/link-number-to-email';
import {faker} from '@faker-js/faker';
import {
  EmailAddress,
  constructEvent,
  isEventOfType,
} from '../../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {
  arbitraryActor,
  getLeftOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {applyToResource} from '../../../src/commands/apply-command-to-resource';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('linkNumberToEmail', () => {
  let framework: TestFramework;
  let applyLinkNumberToEmail: ReturnType<
    typeof applyToResource<LinkNumberToEmail>
  >;
  beforeEach(async () => {
    framework = await initTestFramework();
    applyLinkNumberToEmail = applyToResource(
      framework.depsForApplyToResource,
      linkNumberToEmail
    );
  });
  afterEach(() => {
    framework.close();
  });

  const command = {
    email: faker.internet.email() as EmailAddress,
    memberNumber: faker.number.int(),
    name: undefined,
    formOfAddress: undefined,
    actor: arbitraryActor(),
  };

  describe('when give the same command multiple times', () => {
    beforeEach(async () => {
      await applyLinkNumberToEmail(command, arbitraryActor())();
      await applyLinkNumberToEmail(command, arbitraryActor())();
    });

    it('only raises one event', async () => {
      const events = await framework.getAllEvents();
      expect(events).toHaveLength(1);
      expect(isEventOfType('MemberNumberLinkedToEmail')(events[0])).toBe(true);
    });
  });

  describe('when the member number already exists', () => {
    it('fails', async () => {
      framework.insertIntoSharedReadModel(
        constructEvent('MemberNumberLinkedToEmail')({
        memberNumber: command.memberNumber,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
        actor: arbitraryActor(),
        })
      );

      const result = getLeftOrFail(
        await linkNumberToEmail.process({
          command,
          rm: framework.sharedReadModel,
        })()
      );

      expect(result).toMatchObject({
        message: 'The requested member number is already linked to an email address',
        status: StatusCodes.BAD_REQUEST,
      });
    });
  });

  describe('when the email address is already in use', () => {
    it('raises an event documenting the attempt', async () => {
      framework.insertIntoSharedReadModel(
        constructEvent('MemberNumberLinkedToEmail')({
        memberNumber: faker.number.int(),
        email: command.email,
        name: undefined,
        formOfAddress: undefined,
        actor: arbitraryActor(),
        })
      );

      const result = pipe(
        await getTaskEitherRightOrFail(
          linkNumberToEmail.process({
            command,
            rm: framework.sharedReadModel,
          })
        ),
        O.filter(
          isEventOfType('LinkingMemberNumberToAnAlreadyUsedEmailAttempted')
        ),
        getSomeOrFail
      );

      expect(result.email).toStrictEqual(command.email);
    });
  });

  describe('when both the email and member number are new', () => {
    it('raises an event linking the number and email', async () => {
      const event = pipe(
        await getTaskEitherRightOrFail(
          linkNumberToEmail.process({
            command,
            rm: framework.sharedReadModel,
          })
        ),
        O.filter(isEventOfType('MemberNumberLinkedToEmail')),
        getSomeOrFail
      );

      expect(event.email).toStrictEqual(command.email);
      expect(event.memberNumber).toStrictEqual(command.memberNumber);
    });
  });
});
