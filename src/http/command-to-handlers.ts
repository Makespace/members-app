import {Dependencies} from '../dependencies';
import {Config} from '../configuration';
import {Command} from '../commands';
import {Form} from '../types/form';
import expressAsyncHandler from 'express-async-handler';
import {flow} from 'fp-ts/lib/function';
import {formPost} from './form-post';
import {formGet} from './form-get';
import {apiToHandlers} from './api-to-handlers';

export const commandToHandlers =
  (deps: Dependencies, conf: Config) =>
  <C, V>(noun: string, verb: string, cmd: Command<C> & Form<V>) => [
    {
      path: `/${noun}/${verb}`,
      handler: flow(formPost, expressAsyncHandler)(deps, cmd, `/${noun}`),
      method: 'post' as const,
    },
    {
      path: `/${noun}/${verb}`,
      handler: flow(formGet, expressAsyncHandler)(deps, cmd),
      method: 'get' as const,
    },
    ...apiToHandlers(deps, conf)(noun, verb, cmd),
  ];
