import * as O from 'fp-ts/Option';
import { SharedReadModel } from "../../read-models/shared-state";
import { Actor } from "../../types";

export const isSelf = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {
    memberNumber: number;
  };
}) => {
  if (input.actor.tag !== 'user') {
    return false;
  }
  const member = input.rm.members.findUserIdByMemberNumber(input.actor.user.memberNumber);
  if (O.isNone(member)) {
    return false;
  }
  const requestedMember = input.rm.members.findUserIdByMemberNumber(
    input.input.memberNumber
  );
  return O.isSome(requestedMember) && member.value === requestedMember.value;
};
