import * as TE from 'fp-ts/TaskEither';
import {Email} from '../types';

type SendEmail = (
  email: Email,
  message: string
) => TE.TaskEither<string, string>;

export const sendEmail = (): SendEmail => () =>
  TE.left('sendEmail not implemented');
