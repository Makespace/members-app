import jwt from 'jsonwebtoken';
import {Config} from '../configuration';

export const createSignedToken =
  (conf: Config) =>
  (payload: object): string =>
    jwt.sign(payload, conf.TOKEN_SECRET, {expiresIn: '10m'});
