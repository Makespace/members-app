import {Member, MemberCoreInfo} from '../return-types';
import {ReadonlyNonEmptyArray} from 'fp-ts/lib/ReadonlyNonEmptyArray';

export const mergeMembers = (m: ReadonlyNonEmptyArray<Member>): Member => {
  return m[0];
};

export type MemberCoreInfoPreMerge = Omit<MemberCoreInfo, 'memberNumbers'> & {
  memberNumber: number;
};

export const mergeMemberCore = (
  // Array should be in order of priority with index = 0 being highest priority.
  m: ReadonlyNonEmptyArray<MemberCoreInfoPreMerge>
): MemberCoreInfo => ({
  memberNumbers: m.map(e => e.memberNumber),
  emailAddress: m[0].emailAddress,
  prevEmails: m.flatMap(e => [...e.prevEmails, e.emailAddress]),
  name: m[0].name,
  formOfAddress: m[0].formOfAddress,
  agreementSigned: m[0].agreementSigned,
  isSuperUser: m[0].isSuperUser,
  superUserSince: m[0].superUserSince,
  gravatarHash: m[0].gravatarHash,
  status: m[0].status,
});
