import { DateTime, Duration } from "luxon";
import * as O from 'fp-ts/Option';
import { Logger } from "pino";


export const resyncRecurlyInformation = (
    syncInterval: Duration = Duration.fromMillis(1000 * 60 * 20)
) => {
    let lastRecurlySync: O.Option<DateTime> = O.none;
    return (logger: Logger) => {
        if (
            O.isSome(lastRecurlySync) &&
            lastRecurlySync.value.diffNow().negate() < syncInterval
        ) {
            logger.info(
                'Skipping recurly sync, next sync in %s',
                syncInterval.minus(
                    lastRecurlySync.value.diffNow().negate()
                ).toHuman()
            );
            return;
        }
        lastRecurlySync = O.some(DateTime.now());


    };
};

