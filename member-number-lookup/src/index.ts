import express, {Application, Request, Response} from 'express';
import {landingPage} from './landing-page';

const app: Application = express();
const port = 8080;

app.get('/', (req: Request, res: Response) => {
  res.status(200).send(landingPage);
});

app.listen(port, () =>
  process.stdout.write(`Server is listening on port ${port}!\n`)
);
