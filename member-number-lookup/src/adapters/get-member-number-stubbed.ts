import * as TE from 'fp-ts/TaskEither';
import {EmailAddress, Failure} from '../types';
import {pipe} from 'fp-ts/lib/function';
import {faker} from '@faker-js/faker';

type GetMemberNumber = (
  emailAddress: EmailAddress
) => TE.TaskEither<Failure, number>;

export const getMemberNumberStubbed = (): GetMemberNumber => () =>
  pipe(faker.number.int(), TE.right);
