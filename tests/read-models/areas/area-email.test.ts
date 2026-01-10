import {faker} from '@faker-js/faker';
import {DomainEvent} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {getArea} from '../../../src/read-models/areas/get-area';
import {getSomeOrFail} from '../../helpers';
import {pipe} from 'fp-ts/lib/function';
import {EmailAddress} from '../../../src/types';

describe('area email', () => {
  let events: ReadonlyArray<DomainEvent>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  describe('when area email is set', () => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const email = faker.internet.email() as EmailAddress;

    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      await framework.commands.area.setMailingList({
        id: createArea.id,
        email,
      });
      events = await framework.getAllEvents();
    });

    it('returns the area with email', () => {
      const area = pipe(createArea.id, getArea(events), getSomeOrFail);
      expect(area.id).toStrictEqual(createArea.id);
      expect(area.email).toStrictEqual({_tag: 'Some', value: email});
    });
  });

  describe('when area email is not set', () => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };

    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      events = await framework.getAllEvents();
    });

    it('returns the area with none email', () => {
      const area = pipe(createArea.id, getArea(events), getSomeOrFail);
      expect(area.id).toStrictEqual(createArea.id);
      expect(area.email).toStrictEqual({_tag: 'None'});
    });
  });

  describe('when area email is unset with empty string', () => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const email = faker.internet.email() as EmailAddress;

    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      await framework.commands.area.setMailingList({
        id: createArea.id,
        email,
      });
      await framework.commands.area.setMailingList({
        id: createArea.id,
        email: '',
      });
      events = await framework.getAllEvents();
    });

    it('returns the area with none email', () => {
      const area = pipe(createArea.id, getArea(events), getSomeOrFail);
      expect(area.id).toStrictEqual(createArea.id);
      expect(area.email).toStrictEqual({_tag: 'None'});
    });
  });
});
