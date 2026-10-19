import * as t from 'io-ts';

// Reminder emails go out a month, a week and a day before an owner's
// agreement term ends, each at most once per term.
export const ReminderStage = t.union([
  t.literal('month'),
  t.literal('week'),
  t.literal('day'),
]);
export type ReminderStage = t.TypeOf<typeof ReminderStage>;
