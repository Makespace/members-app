import {loadCachedTroubleTicketData} from '../../src/load-cached-sheet-data';
import {getCachedSheetData} from '../../src/init-dependencies/google/get-cached-sheet-data';
import pino from 'pino';
import {ensureCachedSheetDataTableExists} from '../../src/init-dependencies/google/ensure-cached-sheet-data-table-exists';
import {getLeftOrFail, getRightOrFail} from '../helpers';
import {constructEvent, EventOfType} from '../../src/types/domain-event';
import {faker} from '@faker-js/faker';
import {initTestFramework, TestFramework} from '../read-models/test-framework';
import {cacheSheetData} from '../../src/init-dependencies/google/cache-sheet-data';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as N from 'fp-ts/number';
import * as D from 'fp-ts/Date';
import * as O from 'fp-ts/Option';
import {contramap} from 'fp-ts/lib/Ord';
import {TroubleTicket} from '../../src/read-models/shared-state/return-types';

const bySubmittedEpochTroubleTicketEvent = pipe(
  N.Ord,
  contramap(
    (tt: EventOfType<'TroubleTicketResponseSubmitted'>) =>
      tt.response_submitted_epoch_ms
  )
);
const bySubmittedEpochTroubleTicket = pipe(
  D.Ord,
  contramap((tt: TroubleTicket) => tt.responseSubmitted)
);

const expectTroubleTicketToMatchResponses = (
  submitted: ReadonlyArray<EventOfType<'TroubleTicketResponseSubmitted'>>,
  resultant: ReadonlyArray<TroubleTicket>
) => {
  const expected = RA.sortBy([bySubmittedEpochTroubleTicketEvent])(submitted);
  const actual = RA.sortBy([bySubmittedEpochTroubleTicket])(resultant);
  expect(expected).toHaveLength(actual.length);
  for (const [e, a] of RA.zip(expected)(actual)) {
    expect(e.responseSubmitted.getTime()).toStrictEqual(
      a.response_submitted_epoch_ms
    );
    expect(e.emailAddress).toStrictEqual(O.fromNullable(a.email_address));
    expect(e.submitterMembershipNumber).toStrictEqual(
      O.fromNullable(a.submitter_membership_number)
    );
    expect(e.submitterName).toStrictEqual(O.fromNullable(a.submitter_name));
    expect(e.whichEquipment).toStrictEqual(O.fromNullable(a.which_equipment));
  }
};

describe('Load cached trouble ticket data', () => {
  const troubleTicketSheetId = '123';

  let _loadCachedTroubleTicket: ReturnType<typeof loadCachedTroubleTicketData>;
  let _cacheSheetData: ReturnType<typeof cacheSheetData>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
    getRightOrFail(
      await ensureCachedSheetDataTableExists(framework.eventStoreDb)()
    );
    _cacheSheetData = cacheSheetData(framework.eventStoreDb);
    _loadCachedTroubleTicket = loadCachedTroubleTicketData(
      troubleTicketSheetId,
      getCachedSheetData(framework.eventStoreDb),
      framework.sharedReadModel.updateState
    );
  });
  describe('Load previously cached trouble tickets', () => {
    const timestamp = new Date(2024, 1, 23, 4, 23, 45);
    const trainingQuizResults: ReadonlyArray<
      EventOfType<'TroubleTicketResponseSubmitted'>
    > = [
      constructEvent('TroubleTicketResponseSubmitted')({
        response_submitted_epoch_ms: timestamp.getTime() - 5000,
        email_address: faker.internet.email(),
        which_equipment: faker.commerce.product(),
        submitter_name: faker.person.fullName(),
        submitter_membership_number: faker.number.int({min: 1, max: 9999}),
        submitted_response: {
          'Fav dog?': faker.animal.dog(),
        },
      }),
      constructEvent('TroubleTicketResponseSubmitted')({
        response_submitted_epoch_ms: timestamp.getTime() - 4000,
        email_address: faker.internet.email(),
        which_equipment: faker.commerce.product(),
        submitter_name: faker.person.fullName(),
        submitter_membership_number: faker.number.int({min: 1, max: 9999}),
        submitted_response: {
          'Fav dog?': faker.animal.dog(),
        },
      }),
    ];
    describe('Cache load with no store', () => {
      it('Check no responses are retrieved', async () => {
        getLeftOrFail(await _loadCachedTroubleTicket());
        const troubleTickets =
          framework.sharedReadModel.troubleTickets.getAll();
        expectTroubleTicketToMatchResponses([], troubleTickets);
      });
    });
    describe('Cache store + load', () => {
      beforeEach(async () => {
        await _cacheSheetData(
          timestamp,
          troubleTicketSheetId,
          pino({level: 'silent'}),
          trainingQuizResults
        );
      });

      it('Check both responses are retrieved', async () => {
        getRightOrFail(await _loadCachedTroubleTicket());
        const troubleTickets =
          framework.sharedReadModel.troubleTickets.getAll();
        expectTroubleTicketToMatchResponses(
          trainingQuizResults,
          troubleTickets
        );
      });
    });
    describe('Double store then cache load', () => {
      beforeEach(async () => {
        for (let i = 0; i < 2; i++) {
          await _cacheSheetData(
            timestamp,
            troubleTicketSheetId,
            pino({level: 'silent'}),
            trainingQuizResults
          );
        }
      });

      it('Check both responses are retrieved', async () => {
        // Specifically interested we don't double-store.
        getRightOrFail(await _loadCachedTroubleTicket());
        const troubleTickets =
          framework.sharedReadModel.troubleTickets.getAll();
        expectTroubleTicketToMatchResponses(
          trainingQuizResults,
          troubleTickets
        );
      });
    });
  });
});
