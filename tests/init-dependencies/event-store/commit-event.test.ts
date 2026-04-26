import { faker } from "@faker-js/faker";
import * as libsqlClient from '@libsql/client';
import { constructEvent, EmailAddress, StoredDomainEvent } from "../../../src/types";
import { arbitraryActor, getLeftOrFail, getRightOrFail } from "../../helpers";
import { ensureEventTableExists } from "../../../src/init-dependencies/event-store/ensure-events-table-exists";
import { getAllEvents } from "../../../src/init-dependencies/event-store/get-all-events";
import { commitEvent } from "../../../src/init-dependencies/event-store/commit-event";
import { Int } from "io-ts";
import * as E from 'fp-ts/Either';
import pino from "pino";
import { FailureWithStatus } from "../../../src/types/failure-with-status";
import { StatusCodes } from "http-status-codes";
import { initSharedReadModel } from "../../../src/read-models/shared-state";
import { insertEventWithOptimisticConcurrencyControl } from "../../../src/init-dependencies/event-store/insert-event-with-optimistic-concurrency-control";

const arbitaryEvent = () =>
  constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
    actor: arbitraryActor(),
  });

type CommitEventReturn = E.Either<FailureWithStatus, {status: number; message: string}>;

describe('commit-event', () => {
    const logger = pino({level: 'silent'});
    let dbClient: libsqlClient.Client;
    let getStoredEvents: () => Promise<ReadonlyArray<StoredDomainEvent>>;
    let initialisedCommitEvent: ReturnType<typeof commitEvent>;
    beforeEach(async () => {
        dbClient = libsqlClient.createClient({url: ':memory:'});
        getRightOrFail(await ensureEventTableExists(dbClient)());
        getStoredEvents = async () => getRightOrFail(await getAllEvents(dbClient)()());
        initialisedCommitEvent = commitEvent(dbClient, logger, () => async () => {});
    });

    afterEach(() => {
        dbClient.close();
    });

    describe('commit an event', () => {
        const event = arbitaryEvent();
        let result: CommitEventReturn;
        beforeEach(async () => {
            result = await initialisedCommitEvent(0 as Int)(event)();
        });

        it('result returned success', () => {
            const right = getRightOrFail(result);
            expect(right.message).toStrictEqual('Raised event');
            expect(right.status).toStrictEqual(StatusCodes.CREATED);
        });

        it('event was committed', async () => {
            const storedEvents = await getStoredEvents();
            expect(storedEvents).toHaveLength(1);
            expect(storedEvents[0]).toMatchObject({
                ...event,
                event_index: 1,
            });
        });

        describe('try and commit first event again', () => {
            let result: CommitEventReturn;
            beforeEach(async() => {
                result = await initialisedCommitEvent(0 as Int)(event)();
            });

            it('commit was rejected due to OCC conflict', () => {
                expect(getLeftOrFail(result).message).toStrictEqual('Resource has changes since the event to be committed was computed');
            });

            describe('commit another event', () => {
                const event2 = arbitaryEvent();
                let result: CommitEventReturn;
                beforeEach(async () => {
                    result = await initialisedCommitEvent(1 as Int)(event2)();
                });

                it('result returned success', () => {
                    const right = getRightOrFail(result);
                    expect(right.message).toStrictEqual('Raised event');
                    expect(right.status).toStrictEqual(StatusCodes.CREATED);
                });

                it('event was committed', async () => {
                    const storedEvents = await getStoredEvents();
                    expect(storedEvents).toHaveLength(2);
                    expect(storedEvents[1]).toMatchObject({
                        ...event2,
                        event_index: 2,
                    });
                });
            });
        });
    });

    describe('when the read model cursor is stale', () => {
        const committedElsewhere = arbitaryEvent();
        const rejectedEvent = arbitaryEvent();
        const nextEvent = arbitaryEvent();
        let sharedReadModel: ReturnType<typeof initSharedReadModel>;
        let conflictResult: CommitEventReturn;
        let nextResult: CommitEventReturn;

        beforeEach(async () => {
            sharedReadModel = initSharedReadModel(dbClient, logger);

            getRightOrFail(await insertEventWithOptimisticConcurrencyControl(
                committedElsewhere,
                0 as Int,
                dbClient,
            )());

            conflictResult = await commitEvent(dbClient, logger, sharedReadModel.asyncRefresh)(
                sharedReadModel.getCurrentEventIndex()
            )(rejectedEvent)();

            nextResult = await commitEvent(dbClient, logger, sharedReadModel.asyncRefresh)(
                sharedReadModel.getCurrentEventIndex()
            )(nextEvent)();
        });

        it('refreshes the read model after the conflict', () => {
            expect(getLeftOrFail(conflictResult).message).toStrictEqual('Resource has changes since the event to be committed was computed');
            expect(sharedReadModel.getCurrentEventIndex()).toStrictEqual(2);
        });

        it('allows the next write to succeed with the refreshed cursor', async () => {
            const right = getRightOrFail(nextResult);
            expect(right.message).toStrictEqual('Raised event');
            expect(right.status).toStrictEqual(StatusCodes.CREATED);

            const storedEvents = await getStoredEvents();
            expect(storedEvents).toHaveLength(2);
            expect(storedEvents[1]).toMatchObject({
                ...nextEvent,
                event_index: 2,
            });
        });
    });
});
