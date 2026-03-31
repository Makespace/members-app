# Initial Specification
- Using a PLAN.md file plan how to implement the ability for admins to delete events.

# Requirements
- Deleted events should still be kept within the event log but should no longer affect the state
- Only Admins should be able to delete events
- Deleting events should use the existing command + form structure
- When deleting an event you should be able to see the details of the event that is being deleted (using the getEventById Dependency)
- Only admins should be able to see the delete event form
- The admin must provide a reason when deleting an event
- Deleted events should appear on the event log but clearly shown as deleted
- Deleted events should appear on the downloaded event log (csv) but with an extra column indicating the event was deleted, the admin that deleted the event and the reason
- For v1 the events only need to be deleted - there is no need to reset the shared state

# Implementation Plan
  1. Add a deleted_events table which stores information about deleted events with the event_id as the foreign primary key.
  2. Update functions which read events to read the deleted_events table and use it to skip those events.
  3. Add a new Command which allows deleting events
  4. Update /event-log and /event-log.csv to mark deleted events and include the deletion metadata
  5. Update /event-log to include a button to take the user to a form which allows deleting a selected event
  6. Add tests for all newly added code
  