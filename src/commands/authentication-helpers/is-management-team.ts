import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Actor} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';

// The imported mailbox holds member correspondence, so seeing it - and
// acting on it - is for owners of the management team's area, or super
// users. The page and the mailbox commands share this one check so they
// cannot drift apart. Which area is the management team's is configuration,
// which is why this takes it rather than a whole config.
export const isManagementTeam =
  (rm: SharedReadModel, managementTeamAreaId: string) =>
  (actor: Actor): boolean =>
    actor.tag === 'user' &&
    pipe(
      rm.members.getByMemberNumber(actor.user.memberNumber),
      O.match(
        () => false,
        member =>
          member.isSuperUser ||
          (managementTeamAreaId !== '' &&
            member.ownerOf.some(area => area.id === managementTeamAreaId))
      )
    );
