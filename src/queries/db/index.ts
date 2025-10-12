import {sql} from 'drizzle-orm';
import {StatusCodes} from 'http-status-codes';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Query, Params} from '../query';
import {
  sanitizeString,
  joinHtml,
  HttpResponse,
  Html,
  html,
  safe,
  toLoggedInContent,
} from '../../types/html';
import {
  failureWithStatus,
  FailureWithStatus,
  ApplicationStatusCode,
} from '../../types/failure-with-status';
import {Dependencies} from '../../dependencies';
import {User} from '../../types';

interface Args {
  deps: Dependencies;
  user: User;
  params: Params;
  query: Params;
}

class FailureWithStatusError extends Error {
  message: string;
  status: ApplicationStatusCode;
  payload?: unknown;

  constructor(
    message: string,
    status: ApplicationStatusCode,
    payload?: unknown
  ) {
    super(message);
    this.message = message;
    this.status = status;
    this.payload = payload;
  }

  toFailureWithStatus(): FailureWithStatus {
    return failureWithStatus(this.message, this.status)(this.payload);
  }
}

type Handler = (args: Args) => Promise<HttpResponse>;

function thrownToString(error: unknown): string {
  if (error instanceof Error) {
    return error.toString();
  } else if (typeof error === 'string') {
    return error;
  } else {
    return JSON.stringify(error);
  }
}

function imperativeAdaptor(handler: Handler): Query {
  return deps => (user: User, params: Params, query: Params) =>
    TE.tryCatch(
      () =>
        handler({
          deps,
          user,
          params,
          query,
        }),
      error => {
        if (error instanceof FailureWithStatusError) {
          return error.toFailureWithStatus();
        } else {
          return failureWithStatus(
            thrownToString(error),
            StatusCodes.INTERNAL_SERVER_ERROR
          )(error);
        }
      }
    );
}

function isSuperUser(args: Args): boolean {
  const {user, deps} = args;
  const member = O.toUndefined(
    deps.sharedReadModel.members.get(user.memberNumber)
  );
  return member !== undefined && member.isSuperUser;
}

function ensureSuperUser(args: Args): void {
  if (!isSuperUser(args)) {
    throw new FailureWithStatusError(
      'You are not authorised to see this page',
      StatusCodes.FORBIDDEN
    );
  }
}

function renderQueryPage(q: string, content: Html): HttpResponse {
  return toLoggedInContent(safe('DB'))(html`
        <div class="stack-large">
          <form action="/db" method="get">
            <label for="q">Query</label>
            <input id="q" name="q" value="${sanitizeString(q)}" />
            ${content}
        </div>
      `);
}

export const db: Query = imperativeAdaptor(async (args: Args) => {
  ensureSuperUser(args);

  const q = args.query.q || '';

  if (q.length === 0) {
    return renderQueryPage(q, html``);
  }

  const db = args.deps.sharedReadModel.readOnlyDb;
  let rows: {[k: string]: string}[];
  try {
    rows = db.all(sql.raw(q));
  } catch (e) {
    return renderQueryPage(
      q,
      html`Error: ${sanitizeString(thrownToString(e))}`
    );
  }
  if (rows.length === 0) {
    return renderQueryPage(q, html`No results.`);
  } else {
    const columns = Object.keys(rows[0]);
    const headerContent = columns.map(
      name => html`<th>${sanitizeString(name)}</th>`
    );
    const bodyContent = rows.map(row => {
      columns.map(name => html`<th>${sanitizeString(name)}</th>`);
      const tds = columns.map(
        column => html`<td>${sanitizeString(`${row[column]}`)}</td>`
      );
      return html`<tr>
        ${joinHtml(tds)}
      </tr>`;
    });
    const header = html`<thead>
      <tr>
        ${joinHtml(headerContent)}
      </tr>
    </thead>`;
    const body = html`<tbody>
      ${joinHtml(bodyContent)}
    </tbody>`;
    return renderQueryPage(
      q,
      html`<table>
        ${header}${body}
      </table>`
    );
  }
});
