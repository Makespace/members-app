import {Actor} from '../../../types';
import {EmailAddress} from '../../../types';
import {Member} from '../return-types';

type MultipleMembers = Map<number, Member>;

const redactEmail = (member: Member): Member =>
  Object.assign({}, member, {
    primaryEmailAddress: '******' as EmailAddress,
    emails: member.emails.map(email => ({
      ...email,
      emailAddress: '******' as EmailAddress,
    })),
  });

// Fob details are admin-only: unlike emails, a member doesn't see their own.
const redactFobs = (member: Member): Member =>
  Object.assign({}, member, {fobs: []});

// Is |actor| privileged enough (a token, the system, or a super user) to see
// every member's sensitive details?
const isPrivileged = (actor: Actor) => (members: MultipleMembers) => {
  switch (actor.tag) {
    case 'token':
      return true;
    case 'system':
      return true;
    case 'user': {
      const viewingMember = members.get(actor.user.memberNumber);
      return viewingMember !== undefined && viewingMember.isSuperUser;
    }
  }
};

// If a given |actor|, with the context of |details| is viewing |member|
// should sensitive details (email) about that member be redacted.
const shouldRedactEmail =
  (actor: Actor) => (members: MultipleMembers) => (member: Member) => {
    if (isPrivileged(actor)(members)) {
      return false;
    }
    return !(
      actor.tag === 'user' &&
      actor.user.memberNumber === member.memberNumber
    );
  };

export const redactDetailsForActor =
  (actor: Actor) => (members: MultipleMembers) => {
    const needsEmailRedaction = shouldRedactEmail(actor)(members);
    const needsFobRedaction = !isPrivileged(actor)(members);
    const redactedDetails = new Map();
    for (const [memberNumber, member] of members.entries()) {
      let redacted = member;
      if (needsEmailRedaction(member)) {
        redacted = redactEmail(redacted);
      }
      if (needsFobRedaction) {
        redacted = redactFobs(redacted);
      }
      redactedDetails.set(memberNumber, redacted);
    }
    return redactedDetails;
  };
