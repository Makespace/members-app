import {Email} from './email';
import * as TE from 'fp-ts/TaskEither';

type Ports = {
  sendMemberNumberEmail: (
    email: Email,
    memberNumber: number
  ) => TE.TaskEither<string, void>;
  getMemberNumberForEmail: (
    email: Email
  ) => TE.TaskEither<string, ReadonlyArray<number>>;
};

type SendMemberNumberToEmail = (ports: Ports) => (email: string) => void;

export const sendMemberNumberToEmail: SendMemberNumberToEmail = () => () =>
  undefined;
