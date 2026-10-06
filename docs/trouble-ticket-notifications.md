# Switching on the trouble ticket notifications

The notification stack can be deployed before it is allowed to write to
anybody. `TROUBLE_TICKET_NOTIFY_TO` decides who the mail may actually go to:

| value | who receives |
| --- | --- |
| unset (the default) | nobody |
| `a@example.com,b@example.com` | only those addresses |
| `all` | everybody |

It is deliberately **not** in `fly.toml`, so the default is off and
`fly secrets set` is the only thing that changes it. Setting a secret restarts
the machine, which is all the worker needs.

Everything else runs regardless: the audience is worked out, the summaries are
composed, the watermarks move. Held-back mail is logged instead of sent:

```
Held back a trouble ticket notification
  wouldHaveEmailed: ... about: "Trouble tickets this week: 3 changes"
```

That log is the point of the exercise. A drill can prove the logic; only
production has the real machines, the real owners and the real ticket history.

## The sequence

1. **Deploy with the secret unset.** `/notification-settings` goes live and
   members can set their preferences. Nothing is sent.

2. **Read the logs for a day or so.** `fly logs | grep "Held back"` says who
   would have been written to and about what. Check it against who actually
   looks after each machine before anybody's inbox is involved.

3. **Let yourself through.**

   ```
   fly secrets set TROUBLE_TICKET_NOTIFY_TO=you@makespace.org
   ```

   Now make yourself an owner and a trainer somewhere, raise a ticket on the
   Google Form, and watch the live mail arrive and a summary follow. The
   summary check runs hourly and on startup.

4. **Let everybody through.**

   ```
   fly secrets set TROUBLE_TICKET_NOTIFY_TO=all
   ```

## What to expect when you switch it on

- **No backlog.** The summary watermarks moved while the mail was held back,
  and each held-back summary is recorded with `suppressed: true`, so nobody
  receives the whole quiet stretch at once. The live notifier likewise wrote
  its sent-markers, so only genuinely new changes are notified.
- **A real first summary.** People's first weekly summary covers up to a week
  of genuine activity, so it will not be empty.
- **A week of role changes catches up.** The role-change job does nothing at
  all while the mail is held back: overruling somebody's choice is only fair
  because they are told it happened, so with nobody to tell, their choice is
  left alone. Within a week of switching on, anybody made an owner or trainer
  in the preceding seven days gets their default set and an email saying so.

## Turning it off again

Set it back to unset (`fly secrets unset TROUBLE_TICKET_NOTIFY_TO`) and the
mail stops while the rest keeps working. Preferences members have already set
are untouched.

## Trying it without deploying anything

`make notification-drill` plays ten situations through a throwaway in-memory
copy of the app and reports who would be told what. See CLAUDE.md.
