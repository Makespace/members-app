import {faker} from '@faker-js/faker';
import {Dependencies} from '../dependencies';
import * as TE from 'fp-ts/TaskEither';

export const getTrainersStubbed = (): Dependencies['getTrainers'] => () =>
  TE.right(
    faker.helpers.multiple(() => ({
      name: `${faker.person.firstName()} ${faker.person.lastName()}`,
      equipment: faker.commerce.product(),
      email: faker.internet.email(),
      becameTrainerAt: faker.date.past(),
    }))
  );
