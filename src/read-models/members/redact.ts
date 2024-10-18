import {Actor} from '../../types';
import {Member, MultipleMembers} from './return-types';

const redactEmail = (member: Member): Member =>
  Object.assign({}, member, {emailAddress: '******'});

// If a given |actor|, with the context of |details| is viewing |member|
// should sensitive details (email) about that member be redacted.
const shouldRedact =
  (actor: Actor) => (members: MultipleMembers) => (member: Member) => {
    switch (actor.tag) {
      case 'token':
        return false;
      case 'system':
        return false;
      case 'user': {
        const viewingUser = actor.user;
        const viewingMember = members.get(viewingUser.memberNumber);
        if (viewingMember !== undefined && viewingMember.isSuperUser) {
          return false;
        }
        if (viewingUser.memberNumber === member.memberNumber) {
          return false;
        }
        return true;
      }
    }
  };

export const redactDetailsForActor =
  (actor: Actor) => (members: MultipleMembers) => {
    const needsRedaction = shouldRedact(actor)(members);
    const redactedDetails = new Map();
    for (const [memberNumber, member] of members.entries()) {
      if (needsRedaction(member)) {
        redactedDetails.set(memberNumber, redactEmail(member));
      } else {
        redactedDetails.set(memberNumber, member);
      }
    }
    return redactedDetails;
  };
