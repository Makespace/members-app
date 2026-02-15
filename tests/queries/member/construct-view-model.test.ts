import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import * as E from 'fp-ts/Either';
import {constructViewModel} from '../../../src/queries/member/construct-view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

describe('construct-view-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const unregisteredUser = arbitraryUser();
  const unprivilegedUser = arbitraryUser();
  const superUser = arbitraryUser();
  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: unprivilegedUser.memberNumber,
      email: unprivilegedUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
  });

  [
    ['unregistered user', unregisteredUser],
    ['super user', superUser],
    ['normal user', unprivilegedUser],
  ].forEach(
    (userDesc, userViewingPage) => {

    }
  );

  describe('member exists', () => {

    

    describe('viewing as super user', () => [

    ]);

    beforeEach(() => {
      constructViewModel(
        framework,

      )
    });
  });
});
