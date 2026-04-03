import { pipe } from "fp-ts/lib/function";
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
  const member = input.rm.members.get(input.actor.user.memberNumber);
  if (O.isNone(member)) {
    return false;
  }
  return input.actor.user.memberNumber === input.input.memberNumber;
};
