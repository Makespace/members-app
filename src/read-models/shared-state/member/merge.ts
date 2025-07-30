import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {MemberCoreInfo} from '../return-types';
import {ReadonlyNonEmptyArray} from 'fp-ts/lib/ReadonlyNonEmptyArray';
import {pipe} from 'fp-ts/lib/function';

export type MemberCoreInfoPreMerge = Omit<
  MemberCoreInfo,
  'pastMemberNumbers'
> & {
  memberNumber: number;
};

export const mergeMemberCore = (
  // Array should be in order of priority with index = 0 being highest priority.
  records: ReadonlyNonEmptyArray<MemberCoreInfoPreMerge>
): MemberCoreInfo => {
  const memberNumbers = records.map(e => e.memberNumber);
  const emailAddress = records[0].emailAddress;
  const isSuperUser = records.map(r => r.isSuperUser).some(b => b);
  const superUserSince = records
    .map(r => r.superUserSince)
    .reduce((prev, cur) => {
      if (O.isNone(cur)) {
        return prev;
      }
      if (O.isNone(prev)) {
        return cur;
      }
      if (cur.value < prev.value) {
        return cur;
      }
      return prev;
    }, O.none);
  const memberNumber = Math.max(...memberNumbers);
  const latestJoin = records
    .map(m => m.joined)
    .reduce(
      (latest, current) =>
        current.getTime() > latest.getTime() ? current : latest,
      records[0].joined
    );
  return {
    memberNumber,
    pastMemberNumbers: pipe(
      memberNumbers,
      RA.filter(m => m !== memberNumber)
    ),
    emailAddress,
    prevEmails: records
      .flatMap(e => [...e.prevEmails, e.emailAddress])
      .filter(e => e !== emailAddress),
    name: records[0].name,
    formOfAddress: records[0].formOfAddress,
    agreementSigned: records[0].agreementSigned,
    isSuperUser,
    superUserSince,
    gravatarHash: records[0].gravatarHash,
    status: records[0].status,
    joined: latestJoin,
  };
};
