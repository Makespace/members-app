import {DeclareSuperUserCommand} from './declare';
import {RevokeSuperUser} from './revoke';

export const resource = (
  command: DeclareSuperUserCommand | RevokeSuperUser
) => ({
  type: 'SuperUser',
  id: command.memberNumber.toString(),
});
