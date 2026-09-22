import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Actor} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';

// True when the actor is a logged-in member who owns the given area. Admin and
// super-user access is deliberately not folded in here - callers combine this
// with isAdminOrSuperUser so each command states its own bar.
export const isAreaOwner = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {areaId: UUID};
}): boolean => {
  if (input.actor.tag !== 'user') {
    return false;
  }
  const memberNumber = input.actor.user.memberNumber;
  return pipe(
    input.rm.area.get(input.input.areaId),
    O.match(
      () => false,
      area =>
        area.owners.some(owner =>
          allMemberNumbers(owner).includes(memberNumber)
        )
    )
  );
};
