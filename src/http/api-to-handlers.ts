import {Dependencies} from '../dependencies';
import {Config} from '../configuration';
import {Command} from '../commands';
import expressAsyncHandler from 'express-async-handler';
import {flow} from 'fp-ts/lib/function';
import {apiPost} from './api-post';

export const apiToHandlers =
  (deps: Dependencies, conf: Config) =>
  <C>(noun: string, verb: string, cmd: Command<C>) => [
    {
      path: `/api/${noun}/${verb}`,
      handler: flow(apiPost, expressAsyncHandler)(deps, conf, cmd),
      method: 'post' as const,
    },
  ];
