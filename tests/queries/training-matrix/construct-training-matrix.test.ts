import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import { getFullQuizResultsForMember } from '../../../src/read-models/external-state/equipment-quiz';
import { getRightOrFail, getSomeOrFail } from '../../helpers';
import { constructTrainingMatrix } from '../../../src/queries/training-matrix/construct-view-model';
import { faker } from '@faker-js/faker';
import { LinkNumberToEmail } from '../../../src/commands/member-numbers/link-number-to-email';
import { EmailAddress } from '../../../src/types';
import { MemberNumber } from '../../../src/types/member-number';
import { TrainingMatrix } from '../../../src/queries/training-matrix/render';

const _getTrainingMatrix = (framework: TestFramework) => async (memberNumber: MemberNumber) => {
  return constructTrainingMatrix(
    getSomeOrFail(framework.sharedReadModel.members.get(memberNumber)),
    framework.sharedReadModel,
    getRightOrFail(
      await getFullQuizResultsForMember(framework, memberNumber)()
    )
  );
}

describe('construct-training-matrix', () => {
  let framework: TestFramework;
  let getTrainingMatrix: ReturnType<typeof _getTrainingMatrix>; 
  beforeEach(async () => {
    framework = await initTestFramework();
    getTrainingMatrix = _getTrainingMatrix(framework);
  });
  afterEach(() => {
    framework.close();
  });

  describe('new user', () => {
    const user: LinkNumberToEmail = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
      name: faker.animal.cat(),
      formOfAddress: faker.person.prefix(),
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(user);
    });
    describe('get training matrix', () => {
      let matrix: TrainingMatrix;
      beforeEach(async () => {
        matrix = await getTrainingMatrix(user.memberNumber);
      });

      it('is empty', () => {
        expect(matrix).toHaveLength(0);
      });
    });

    
  });

});
