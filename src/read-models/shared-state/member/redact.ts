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

const isSelf = (actor: Actor, member: Member) =>
  actor.tag === 'user' && actor.user.memberNumber === member.memberNumber;

// An unprivileged |actor| sees their own email but nobody else's, and no
// fob details at all.
export const redactDetailsForActor =
  (actor: Actor) => (members: MultipleMembers) => {
    const privileged = isPrivileged(actor)(members);
    const redactedDetails = new Map();
    for (const [memberNumber, member] of members.entries()) {
      let redacted = member;
      if (!privileged) {
        redacted = redactFobs(redacted);
        if (!isSelf(actor, member)) {
          redacted = redactEmail(redacted);
        }
      }
      redactedDetails.set(memberNumber, redacted);
    }
    return redactedDetails;
  };
