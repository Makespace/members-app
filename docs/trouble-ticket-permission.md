# Ticket permission backfill

Each ticket has one `permission`:

| Value | Readers |
| --- | --- |
| `everybody` | Every logged-in member. |
| `area-owner` | Current owners of the ticket's equipment area, or its directly linked area when there is no equipment. |
| `manager` | Current owners of the area configured by `MANAGEMENT_TEAM_AREA_ID`. |

Super-users can read every ticket. Reporting and assignment no longer grant
access. An `area-owner` ticket with no area is visible only to super-users.

## Running the backfill

Application and worker event readers must support `TroubleTicketPermissionSet`
before applying the backfill. Legacy tickets without an explicit choice read
as `manager` until backfilled.

Preview using the app's admin API token:

```sh
curl -X POST "https://app.makespace.org/api/trouble-tickets/backfill-permission?dryRun=true" \
  -H "Authorization: Bearer <ADMIN_API_BEARER_TOKEN>"
```

Review `candidates` and `groups` in the JSON response, then omit `?dryRun=true`
to apply. Other `dryRun` values are rejected. The backfill assigns
`manager` to tickets currently linked to the management area and `area-owner`
otherwise. It includes resolved tickets and skips deleted tickets and explicit
choices.

The backfill appends `TroubleTicketPermissionSet` events; original creation events
remain unchanged. Commit failures, including concurrent-write conflicts, increment
`failed` in the JSON summary. Check this count even on HTTP 200; rerun to retry
failed entries.
