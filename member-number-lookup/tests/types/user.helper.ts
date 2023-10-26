import {faker} from '@faker-js/faker';
import {User, EmailAddress} from '../../src/types';

export const arbitraryUser = (): User => ({
  emailAddress: faker.internet.email() as EmailAddress,
  memberNumber: faker.number.int(),
});
