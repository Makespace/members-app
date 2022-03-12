import express, {Application, Request, Response} from 'express';
import path from 'path';
import {checkYourMailPage} from './check-your-mail-page';
import {landingPage} from './landing-page';

const app: Application = express();
const port = 8080;

app.get('/', (req: Request, res: Response) => {
  res.status(200).send(landingPage);
});

app.get('/check-your-mail', (req: Request, res: Response) => {
  res.status(200).send(checkYourMailPage('foo'));
});

app.use('/static', express.static(path.resolve(__dirname, './static')));

app.post('/send-member-number-by-email', (req: Request, res: Response) => {
  res.redirect('/check-your-mail');
});

app.listen(port, () =>
  process.stdout.write(`Server is listening on port ${port}!\n`)
);
