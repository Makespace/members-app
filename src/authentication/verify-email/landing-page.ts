import {Request, Response} from 'express';
import {isolatedPageTemplate, oopsPage} from '../../templates';
import {
  html,
  CompleteHtmlDocument,
  safe,
} from '../../types/html';
import { Dependencies } from '../../dependencies';
import { Config } from '../../configuration';
import { decodeEmailVerificationLink } from './email-verification-link';
import { pipe } from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import { verifyEmail } from '../../commands/members/verify-email';
import * as O from 'fp-ts/Option';

const invalidLink = () => oopsPage(
  html`The link you have used is no longer valid. Go back to your
    <a href=/me>homepage</a>.`
);

const verificationSuccessful = pipe(
  html`
    <div class="container">
      <div class="max-w-md mx-auto">
        <h1 class="mb-6">Log in</h1>
        <form action="/auth" method="post">
          <label for="email">E-Mail: </label>
          <input
            id="email"
            type="email"
            required
            name="email"
            value=""
            class="mb-2"
          />
          <p class="text-sm text-gray mb-6">
            Enter email associated with your MakeSpace membership.
          </p>
          <button type="submit" class="w-full mt-6 mb-6">
            Email me a login link
          </button>
        </form>
      </div>
    </div>
  `,
  isolatedPageTemplate(safe('MakeSpace Members App'))
);

export const landing = 
    (deps: Dependencies, conf: Config) =>
    async (req: Request, res: Response<CompleteHtmlDocument>): Promise<void> => {
      const decoded = decodeEmailVerificationLink(deps.logger, conf)(req);
      if (E.isLeft(decoded)) {
        deps.logger.error(
          decoded.left,
          'Failed to decode verification link'
        );
        res.send(invalidLink());
        return;
      }
      const resource = verifyEmail.resource(decoded.right);
      const resourceEvents = await deps.getResourceEvents(resource)();
      if (E.isLeft(resourceEvents)) {
        deps.logger.error(
          resourceEvents.left,
          'Failed to get resource events for email verification link'
        );
        res.send(invalidLink());
        return;
      }

      // Note that we don't need to check isAuthorized here because we are authorised
      // by the user clicking the verification link.
      const resultantEvents = verifyEmail.process({
        events: resourceEvents.right.events,
        command: {
          emailAddress: decoded.right.emailAddress,
          memberNumber: decoded.right.memberNumber,
          actor: {'tag': 'system'}
        }
      });

      if (O.isSome(resultantEvents)) {
        const commitEvent = await deps.commitEvent(resource, resourceEvents.right.version)(resultantEvents.value)();
        if (E.isLeft(commitEvent)) {
          deps.logger.error(
            commitEvent.left,
            'Failed to commit verification link event'
          );
          res.send(invalidLink());
          return;
        }
      }
      deps.logger.info(`Successfully verified email %o`, decoded.right);
      res.send(verificationSuccessful);
      return;
    };
