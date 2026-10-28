# Recurly suspicious-activity monitoring

The sync worker watches the Recurly payments it already caches and emails the
management team about them. It never talks to Recurly itself: it reads the
cache that `src/sync-worker/recurly/pull-recurly-data.ts` refreshes every 20
minutes.

## Why

From June to October 2026 bots used the hosted signup page to test stolen
cards: about 32,600 attempts, ~$3,260 in Recurly fees, and 44 charges on
stolen cards that had to be refunded or were disputed. Nobody noticed for four
months. In normal traffic blocked payments are rare (7 in January–May 2026,
never more than 2 in a day); the attack reached 246 in a day.

## What it sends

- **Alert** - when Recurly records at least `RECURLY_ALERT_BLOCKED_THRESHOLD`
  blocked payments (default 10) within `RECURLY_ALERT_WINDOW_HOURS` (default
  24). "Blocked" means a `fraud_*` decline code - `fraud_gateway` is Stripe
  refusing the payment. Ordinary declines (insufficient funds, expired card)
  don't count. While it continues, the next alert waits a full window.
  Against 2026's data, the defaults would have alerted on 9 June, the attack's
  first full day.
- **Weekly summary** - every Monday after 09:00 UK time, covering the week to
  then: successful, failed and blocked payments, refunds, new accounts, new
  and cancelled subscriptions, and any alerts sent. It goes every week,
  quiet or not, so its arrival also shows the monitor is running.

## Who gets it

The owners of the area in `MANAGEMENT_TEAM_AREA_ID`, or the super users if
that isn't set up. Mail goes through the same gate as every other
notification, `TROUBLE_TICKET_NOTIFY_TO` (see
`docs/trouble-ticket-notifications.md`): held back and logged unless allowed.
Nothing is sent without `RECURLY_TOKEN`, since there would be no data.

Each email is recorded as an event (`RecurlyActivityAlertSent`,
`RecurlyActivitySummarySent`) before it is sent, like the other notifiers:
a missed email is preferred over a duplicate.

## Code

- `src/recurly-monitor/activity.ts` - counting and the two emails (pure).
- `src/sync-worker/notify_recurly_activity.ts` - reads the cache, decides,
  records the event and sends.
- Tests: `tests/recurly-monitor/`, `tests/sync-worker/notify-recurly-activity.test.ts`.

The transaction cache gained `statusCode`, `origin`, `ipAddressCountry` and
`billingCountry` for this (cache schema version 3), so the first sync after
deploying refetches 18 months of transactions. The summary waits until that
refill has happened rather than report an empty week.
