import { SharedReadModel } from "../../read-models/shared-state";
import { Actor } from "../../types";

export const isSelf = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {
    memberNumber: number;
  };
}) => {
  return input.actor.tag === 'user' && input.actor.user.memberNumber === input.input.memberNumber;
};
