import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';

// Meetup's own website reads its data from this GraphQL endpoint, and it
// answers public questions about a public group without a key. It is not a
// documented API, so it may change: a failed pull leaves the last good copy
// in place, and the pages still point people at the Meetup group itself.
const ENDPOINT = 'https://www.meetup.com/gql2';
const GROUP = 'makespace';
const PAGE_SIZE = 100;
const TIMEOUT_MS = 30 * 1000;
// Far more than the group has ever had coming up; a guard against a cursor
// that never ends rather than a real limit.
const MAX_PAGES = 10;

const QUERY = `query($after: String) { groupByUrlname(urlname: "${GROUP}") {
  events(status: ACTIVE, first: ${PAGE_SIZE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges { node { id title dateTime endTime eventUrl description
      going { totalCount } maxTickets rsvpSettings { rsvpsClosed } } } } } }`;

const EventNode = t.type({
  id: t.string,
  title: t.string,
  dateTime: t.string,
  endTime: t.string,
  eventUrl: t.string,
  description: t.union([t.string, t.null]),
  going: t.union([t.type({totalCount: t.number}), t.null]),
  maxTickets: t.union([t.number, t.null]),
  rsvpSettings: t.union([t.type({rsvpsClosed: t.boolean}), t.null]),
});

const Response = t.type({
  data: t.type({
    groupByUrlname: t.type({
      events: t.type({
        pageInfo: t.type({
          hasNextPage: t.boolean,
          endCursor: t.union([t.string, t.null]),
        }),
        edges: t.array(t.type({node: EventNode})),
      }),
    }),
  }),
});

export type MeetupEvent = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  url: string;
  description: string;
  going: number;
  maxTickets: number;
  rsvpsClosed: boolean;
};

const toEvent = (node: t.TypeOf<typeof EventNode>): MeetupEvent => ({
  id: node.id,
  title: node.title,
  startsAt: new Date(node.dateTime),
  endsAt: new Date(node.endTime),
  url: node.eventUrl,
  description: node.description ?? '',
  going: node.going?.totalCount ?? 0,
  maxTickets: node.maxTickets ?? 0,
  rsvpsClosed: node.rsvpSettings?.rsvpsClosed ?? false,
});

const fetchPage = async (after: string | null) => {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'makespace-members-app',
    },
    body: JSON.stringify({query: QUERY, variables: {after}}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Meetup answered ${response.status}`);
  }
  return pipe(
    Response.decode(await response.json()),
    E.getOrElseW(errors => {
      throw new Error(
        `Unexpected answer from Meetup: ${formatValidationErrors(errors).join('; ')}`
      );
    })
  ).data.groupByUrlname.events;
};

// Every upcoming event on the group, a page at a time.
export const fetchUpcomingMeetupEvents = async (): Promise<
  ReadonlyArray<MeetupEvent>
> => {
  const events: MeetupEvent[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchPage(after);
    events.push(...result.edges.map(edge => toEvent(edge.node)));
    if (!result.pageInfo.hasNextPage || result.pageInfo.endCursor === null) {
      break;
    }
    after = result.pageInfo.endCursor;
  }
  return events;
};
