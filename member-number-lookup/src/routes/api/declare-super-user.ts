import {Request, Response} from 'express';
import {Config} from '../../configuration';

export const declareSuperUser =
  (conf: Config) => (req: Request, res: Response) => {
    if (req.headers.authorization !== `Bearer ${conf.ADMIN_API_BEARER_TOKEN}`) {
      res.status(401).send('Unauthorized\n');
    } else {
      res.status(501).send('not implemented');
    }
  };
