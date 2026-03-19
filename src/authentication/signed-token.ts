import jwt from 'jsonwebtoken';
import * as E from 'fp-ts/Either';
import {Config} from '../configuration';
import { failure } from '../types/failure';
import {StringValue} from 'ms';

export const createSignedToken =
  (conf: Config, expiresIn: StringValue) =>
  (payload: object): string =>
    jwt.sign(payload, conf.TOKEN_SECRET, {expiresIn});

export const verifyToken = (token: string, secret: Config['TOKEN_SECRET']) =>
  E.tryCatch(
    () => jwt.verify(token, secret),
    failure('Could not verify token')
  );
