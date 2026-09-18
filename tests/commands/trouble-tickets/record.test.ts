import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {record} from '../../../src/commands/trouble-tickets/record';
import {
  arbitraryActor,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';

const arbitraryTicket = () => ({
  id: faker.string.uuid() as UUID,
  rowHash: faker.string.alphanumeric(64) as NonEmptyString,
  sheetId: faker.string.alphanumeric(10) as NonEmptyString,
  submittedAt: faker.date.past(),
  submittedMemberNumber: faker.number.int({min: 1}) as Int,
  submittedEmail: faker.internet.email(),
  submittedName: faker.person.fullName(),
  submittedEquipment: faker.commerce.productName(),
  otherEquipmentDetail: '',
  status: 'Machine is down',
  attempting: faker.lorem.sentence(),
  issue: faker.lorem.sentence(),
  steps: faker.lorem.sentence(),
});

describe('record-trouble-ticket', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the row has not yet been imported', () => {
    it('emits a TroubleTicketCreated event carrying the raw sheet facts', async () => {
      const ticket = arbitraryTicket();

      const result = await getTaskEitherRightOrFail(
        record.process({
          command: {...ticket, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );

      expect(getSomeOrFail(result)).toMatchObject({
        type: 'TroubleTicketCreated',
        ...ticket,
      });
    });

    it('accepts a submission with no member number, email, name or equipment', async () => {
      const ticket = {
        ...arbitraryTicket(),
        submittedMemberNumber: null,
        submittedEmail: null,
        submittedName: null,
        submittedEquipment: null,
      };

      const result = await getTaskEitherRightOrFail(
        record.process({
          command: {...ticket, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );

      expect(O.isSome(result)).toBe(true);
    });
  });

  describe('when a row with the same hash has already been imported', () => {
    it('emits no event (dedup)', async () => {
      const ticket = arbitraryTicket();
      await framework.commands.troubleTickets.record(ticket);

      const result = await getTaskEitherRightOrFail(
        record.process({
          command: {
            ...arbitraryTicket(),
            rowHash: ticket.rowHash,
            actor: arbitraryActor(),
          },
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(O.none);
    });
  });

  describe('codec contract', () => {
    it('rejects an empty rowHash - it would poison the dedup sentinel', () => {
      const decoded = record.decode({
        ...arbitraryTicket(),
        submittedAt: new Date().toISOString(),
        rowHash: '',
      });
      expect(E.isLeft(decoded)).toBe(true);
    });

    it('rejects a non-integer member number', () => {
      const decoded = record.decode({
        ...arbitraryTicket(),
        submittedAt: new Date().toISOString(),
        submittedMemberNumber: 1.5,
      });
      expect(E.isLeft(decoded)).toBe(true);
    });
  });
});
