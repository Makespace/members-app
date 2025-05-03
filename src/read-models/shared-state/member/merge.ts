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
  records: ReadonlyNonEmptyArray<MemberCoreInfoPreMerge>
): MemberCoreInfo => {
  const memberNumbers = records.map(e => e.memberNumber);
  const emailAddress = records[0].emailAddress;
  return {
    memberNumber: Math.max(...memberNumbers),
    memberNumbers,
    emailAddress,
    prevEmails: records
      .flatMap(e => [...e.prevEmails, e.emailAddress])
      .filter(e => e !== emailAddress),
    name: records[0].name,
    formOfAddress: records[0].formOfAddress,
    agreementSigned: records[0].agreementSigned,
    isSuperUser: records[0].isSuperUser,
    superUserSince: records[0].superUserSince,
    gravatarHash: records[0].gravatarHash,
    status: records[0].status,
  };
};
