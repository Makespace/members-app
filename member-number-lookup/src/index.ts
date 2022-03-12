import express, {Application, Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import path from 'path';
import {checkYourMailPage} from './check-your-mail-page';
import {invalidEmailPage} from './invalid-email-page';
import {landingPage} from './landing-page';
import {sendMemberNumberByEmail} from './send-member-number-by-email';
import * as TE from 'fp-ts/TaskEither';

const app: Application = express();
const port = 8080;

const adapters = {
  getMemberNumberForEmail: (): TE.TaskEither<string, number> => TE.right(42),
};

app.use(express.urlencoded({extended: true}));

app.get('/', (req: Request, res: Response) => {
  res.status(200).send(landingPage);
});

app.use('/static', express.static(path.resolve(__dirname, './static')));

app.post(
  '/send-member-number-by-email',
  async (req: Request, res: Response) => {
    await pipe(
      req.body,
      sendMemberNumberByEmail(adapters),
      TE.matchW(
        () => res.status(400).send(invalidEmailPage),
        email => res.status(200).send(checkYourMailPage(email))
      )
    )();
  }
);

app.listen(port, () =>
  process.stdout.write(`Server is listening on port ${port}!\n`)
);
