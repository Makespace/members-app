import { pipe } from "fp-ts/lib/function";
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import { DateTime } from 'luxon';
import {sequenceS} from 'fp-ts/lib/Apply';
import { Dependencies } from "../dependencies";
import { DomainEvent } from "../types";
import { Logger } from "pino";
import { Option, none, some } from "fp-ts/lib/Option";

export const processEvents = (
    deps: Dependencies,
    logger: Logger,
) => async (
    events: ReadonlyArray<DomainEvent>,
): Promise<ReadonlyArray<DomainEvent>> => {
    console.log('Events');
    events.forEach(console.log);

    return TE.right(RA.empty);
}

export const run = async (
    deps: Dependencies,
    logger: Logger,
): Promise<void> => {
    const equipmentEvents = await deps.getAllResourceEvents('Equipment')();
    if (E.isLeft(equipmentEvents)) {
        logger.error(equipmentEvents.left, 'Failed to process events');
        // TODO - Monitoring.
        return;
    }
    const newEvents = await processEvents(deps, logger)(equipmentEvents.right.events);
    for (const newEvent of newEvents) {
        deps.commitEvent(newEvent )
    }

    deps.commitEvent(newEvents);
);


export const runForever = (deps: Dependencies) => {
    const logger = deps.logger.child({'section': 'training-sheets-worker'});
    run(deps, logger, none).catch(err => logger.error(err, 'Unhandled error in training sheets worker'));
    return setInterval(
        // TODO - Handle run still going when next run scheduled.
        () => run(deps, logger, some(lastRun)).catch(err => logger.error(err, 'Unhandled error in training sheets worker')),
        30 * 60 * 1000,
    );
}
