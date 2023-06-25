import express, {Request, Response, Router} from 'express';
import * as authentication from './authentication';
import path from 'path';
import {checkYourMailPage, landingPage, oopsPage, dashboardPage} from './pages';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import PubSub from 'pubsub-js';
import {sequenceS} from 'fp-ts/lib/Apply';
import {Dependencies} from './dependencies';
import * as TE from 'fp-ts/TaskEither';
import {failure} from './types';

export const createRouter = (deps: Dependencies): Router => {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    res.status(200).send(landingPage);
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  router.get('/dashboard', async (req: Request, res: Response) => {
    await pipe(
      {
        user: pipe(
          req.session,
          authentication.getUserFromSession,
          TE.fromOption(() => failure('You are not logged in.')())
        ),
        trainers: deps.getTrainers(),
      },
      sequenceS(TE.ApplySeq),
      TE.map(dashboardPage),
      TE.matchW(
        failure => res.status(429).send(oopsPage(failure.message)),
        page => res.status(200).send(page)
      )
    )();
  });

  router.post('/send-member-number-by-email', (req: Request, res: Response) => {
    pipe(
      req.body,
      parseEmailAddressFromBody,
      E.mapLeft(
        () => "You entered something that isn't a valid email address."
      ),
      E.matchW(
        msg => res.status(400).send(oopsPage(msg)),
        email => {
          PubSub.publish('send-member-number-to-email', email);
          res.status(200).send(checkYourMailPage(email));
        }
      )
    );
  });

  authentication.configureRoutes(router);

  router.use('/static', express.static(path.resolve(__dirname, './static')));

  router.use((req, res) => {
    res
      .status(404)
      .send(oopsPage('The page you have requested does not exist.'));
  });
  return router;
};
