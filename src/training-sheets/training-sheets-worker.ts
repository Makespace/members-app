import { pipe } from "fp-ts/lib/function";
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {sequenceS} from 'fp-ts/lib/Apply';
import { Dependencies } from "../dependencies";
import { DomainEvent } from "../types";
import { Logger } from "pino";

export const processEvents = (
    deps: Dependencies,
    logger: Logger,
) => (
    events: ReadonlyArray<DomainEvent>
): TE.TaskEither<Error, ReadonlyArray<DomainEvent>> => {
    console.log('Events');
    events.forEach(console.log);

    return TE.right(RA.empty);
}

export const run = (
    deps: Dependencies,
    logger: Logger,
) => () => pipe(
    deps.getAllEvents(),
    TE.map(processEvents(deps, logger)),
    TE.mapLeft((err) => {
        logger.error(err, 'Failed to process events');
    }),
);


export const runForever = (deps: Dependencies) => {
    return setInterval(
        run(deps, deps.logger.child({'section': 'training-sheets-worker'}))(),
        30 * 60 * 1000,
    );
}
