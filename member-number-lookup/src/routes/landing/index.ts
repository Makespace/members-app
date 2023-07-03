import {Request, Response} from 'express';
import {page} from './page';

export const landing = (req: Request, res: Response) => {
  res.status(200).send(page);
};
