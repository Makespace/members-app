import express, {Request, Response, Router} from 'express';
import * as authentication from './authentication';
import path from 'path';
import {checkYourMailPage, landingPage, oopsPage, dashboardPage} from './pages';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import PubSub from 'pubsub-js';

export const createRouter = (): Router => {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    res.status(200).send(landingPage);
  });

  router.get('/dashboard', (req: Request, res: Response) => {
    pipe(
      req.session,
      authentication.getUserFromSession,
      E.fromOption(() => 'You are not logged in.'),
      E.map(dashboardPage),
      E.matchW(
        msg => res.status(429).send(oopsPage(msg)),
        page => res.status(200).send(page)
      )
    );
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
