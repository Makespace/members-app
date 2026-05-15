import { pipe } from "fp-ts/lib/function";
import * as RA from 'fp-ts/ReadonlyArray';
import { Html, joinHtml, sanitizeString } from "../../types/html";
import { inspect } from "node:util";
import { StoredDomainEvent } from "../../types";

export const renderPayload = (event: StoredDomainEvent): Html =>
  // eslint-disable-next-line unused-imports/no-unused-vars
  pipe(event, ({type, actor, recordedAt, event_index, event_id, ...payload}) =>
    pipe(
      payload,
      Object.entries,
      RA.map(([key, value]) => `${key}: ${inspect(value)}`),
      RA.map(sanitizeString),
      joinHtml
    )
  );
