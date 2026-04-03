import {faker} from '@faker-js/faker';
import {getAll} from '../../../src/read-models/areas/get-all';
import {DomainEvent, EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import { LinkNumberToEmail } from '../../../src/commands/member-numbers/link-number-to-email';
import { Int } from 'io-ts';

describe('get-all', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  describe('when no owners have been added', () => {
    beforeEach(async () => {
      await framework.commands.area.create({
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      });
      events = await framework.getAllEvents();
    });

    it('returns no owners', () => {
      const areas = getAll(events);
      expect(areas[0].owners).toStrictEqual([]);
    });
  });

  describe('when owners have been added', () => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const createUser: LinkNumberToEmail = {
      email: faker.internet.email() as EmailAddress,
      memberNumber: faker.number.int() as Int,
      name: undefined,
      formOfAddress: undefined
    };
    const addOwner = {
      areaId: createArea.id,
      memberNumber: createUser.memberNumber,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(createUser);
      await framework.commands.area.create(createArea);
      await framework.commands.area.addOwner(addOwner);
      events = await framework.getAllEvents();
    });

    it('returns the owners', () => {
      const areas = getAll(events);
      expect(areas[0].owners).toStrictEqual([addOwner.memberNumber]);
    });
  });
});
