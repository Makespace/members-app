import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {isSelfOrPrivileged} from '../authentication-helpers/is-self-or-privileged';
import {Actor} from '../../types/actor';
import {SharedReadModel} from '../../read-models/shared-state';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
  // 'reported-by-me' | 'my-areas' | 'other-areas' | 'area:<id>' |
  // 'equipment:<id>'
  scope: tt.NonEmptyString,
  preference: t.keyof({
    live: null,
    daily: null,
    weekly: null,
    none: null,
    // Undoing a choice rather than making one: take whatever sits above.
    follow: null,
  }),
});

type SetNotificationPreference = t.TypeOf<typeof codec>;

// Yours to set; an admin can set somebody else's, which is also how the system
// does it when a role change makes a machine theirs. Only the member number
// bears on it, so a page saving a screenful of rules can ask once rather than
// once per rule.
export const canSetNotificationPreferences = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {memberNumber: number};
}): boolean => isSelfOrPrivileged(input);

// Recording the same choice twice is not a change, so it is not an event: a
// member's history should not fill with the rows they did not touch when they
// saved a page of them.
const process: Command<SetNotificationPreference>['process'] = input => {
  const current = input.rm.notificationPreferences.forMember(
    input.command.memberNumber
  );
  const settled = current.get(input.command.scope) ?? 'follow';
  return TE.right(
    settled === input.command.preference
      ? O.none
      : O.some(
          constructEvent('MemberNotificationPreferenceSet')({
            memberNumber: input.command.memberNumber,
            scope: input.command.scope,
            preference: input.command.preference,
            actor: input.command.actor,
          })
        )
  );
};

export const setNotificationPreference: Command<SetNotificationPreference> = {
  process,
  decode: codec.decode,
  isAuthorized: canSetNotificationPreferences,
};
