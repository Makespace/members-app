import {Dependencies} from './dependencies';
import {Config} from './configuration';
import {commands} from './commands';
import * as queries from './queries';
import {Route, get} from './types/route';
import {authRoutes} from './authentication';
import {queryToHandler, commandToHandlers, ping} from './http';

export const initRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  const query = queryToHandler(deps);
  const command = commandToHandlers(deps, conf);
  return [
    query('/', queries.landing),
    query('/event-log', queries.log),
    query('/areas', queries.areas),
    ...command('areas', 'create', commands.area.create),
    ...command('areas', 'add-owner', commands.area.addOwner),
    query('/areas/:area', queries.area),
    query('/equipment', queries.allEquipment),
    ...command('equipment', 'add', commands.equipment.add),
    ...command(
      'equipment',
      'add-training-sheet',
      commands.equipment.trainingSheet
    ),
    query('/equipment/:equipment', queries.equipment),
    query('/super-users', queries.superUsers),
    ...command('super-users', 'declare', commands.superUser.declare),
    ...command('super-users', 'revoke', commands.superUser.revoke),
    query('/member/:member', queries.member),
    query('/members', queries.members),
    ...command('members', 'create', commands.memberNumbers.linkNumberToEmail),
    get('/ping', ping),
    ...authRoutes,
  ];
};
