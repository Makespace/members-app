import {Logger} from 'pino';

export const logPassThru =
  (logger: Logger, msg: string) =>
  <T>(input: T) => {
    logger.info(msg);
    return input;
  };
