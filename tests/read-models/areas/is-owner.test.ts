import {faker} from '@faker-js/faker';
import {DomainEvent, EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {isOwner} from '../../../src/read-models/areas/is-owner';
import { LinkNumberToEmail } from '../../../src/commands/member-numbers/link-number-to-email';
import { Int } from 'io-ts';

describe('isOwner', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  const owner: LinkNumberToEmail = {
    email: faker.internet.email() as EmailAddress,
    memberNumber: faker.number.int() as Int,
    name: undefined,
    formOfAddress: undefined
  };
  const createArea = {
    id: faker.string.uuid() as UUID,
    name: faker.company.buzzNoun() as NonEmptyString,
  };
  const addOwner = {areaId: createArea.id, memberNumber: owner.memberNumber};

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail(owner);
    await framework.commands.area.create(createArea);
    await framework.commands.area.addOwner(addOwner);
    events = await framework.getAllEvents();
  });
  afterEach(() => {
    framework.close();
  });

  describe('when user is an owner of the area', () => {
    it('returns true', () => {
      expect(isOwner(events)(createArea.id, addOwner.memberNumber)).toBe(true);
    });
  });

  describe('when user is not an owner of the area', () => {
    it('returns false', () => {
      expect(isOwner(events)(createArea.id, faker.number.int())).toBe(false);
    });
  });
});
