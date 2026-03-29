import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import {Command} from '../../src/commands';
import {applyToResource} from '../../src/commands/apply-command-to-resource';
import {arbitraryActor, getTaskEitherRightOrFail} from '../helpers';
import {happyPathAdapters} from '../init-dependencies/happy-path-adapters.helper';

describe('apply-command-to-resource', () => {
  it('passes dependencies to command.process', async () => {
    const actor = arbitraryActor();
    const process = jest.fn(() => TE.right(O.none));
    const command: Command<{id: string}> = {
      resource: ({id}) => ({type: 'Area', id}),
      process,
      decode: t.strict({id: t.string}).decode,
      isAuthorized: () => true,
    };

    await getTaskEitherRightOrFail(
      applyToResource(happyPathAdapters, command)({id: 'area-1'}, actor)
    );

    expect(process).toHaveBeenCalledWith({
      command: {id: 'area-1', actor},
      events: [],
      deps: happyPathAdapters,
    });
  });
});
