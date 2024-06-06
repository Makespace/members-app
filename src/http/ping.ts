import {RequestHandler} from 'express';
import {StatusCodes} from 'http-status-codes';

export const ping: RequestHandler = (req, res) =>
  res.status(StatusCodes.OK).send('pong\n');
