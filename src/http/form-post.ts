import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../types/failure-with-status';
import {Dependencies} from '../dependencies';
import {sequenceS} from 'fp-ts/lib/Apply';
import {Command} from '../commands';
import {Actor} from '../types/actor';
import {getUserFromSession} from '../authentication';
import {oopsPage} from '../templates';
import {applyToResource} from '../commands/apply-command-to-resource';

const getCommandFrom = <T>(body: unknown, command: Command<T>) =>
  pipe(
    body,
    // Stateless command validation rules go in decode.
    // Giving user feedback here is easy but must be stateless.
    // Direct quick feedback loop between the user -> code for validation.
    // No stateful buisness rules should be enforced here. See the notes on formPost for more details.
    command.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(
      failureWithStatus('Could not decode command', StatusCodes.BAD_REQUEST)
    ),
    TE.fromEither
  );

const getActorFrom = (session: unknown, deps: Dependencies) =>
  pipe(
    session,
    getUserFromSession(deps),
    TE.fromOption(() =>
      failureWithStatus('You are not logged in', StatusCodes.UNAUTHORIZED)()
    ),
    TE.map(user => ({tag: 'user', user}) satisfies Actor)
  );

export const formPost =
  <T>(deps: Dependencies, command: Command<T>, successTarget: string) =>
  async (req: Request, res: Response) => {
    // Look at comments to see the core ideas of this pipe / how this works.
    await pipe(
      {
        actor: getActorFrom(req.session, deps),
        // First we use getCommandFrom to statelessly check the input is sensical and in a sense this can be thought of
        // as a fast path to minimise processing for garbage.
        input: getCommandFrom(req.body, command),
        // Second we get all the events. This is because we need all the events to get the authorisation of the command
        // since there are addOwner events we need to read.
        // There are 2 optimisations here we could take if required (but we haven't yet because they aren't needed):
        // 1. Only get the events if the first step (stateslessly validating the command input) actually succeeds. This
        //    would minimise the DDOS potential of a malicious or malformed component spamming the service with crap.
        // 2. We actually only need some events and if we only got those events there would be significantly less data
        //    to process.
        events: deps.getAllEvents(),
      },
      sequenceS(TE.ApplySeq),
      TE.filterOrElse(command.isAuthorized, () =>
        failureWithStatus(
          'You are not authorized to perform this action',
          StatusCodes.UNAUTHORIZED
        )()
      ),
      TE.chain(({input, actor}) =>
        pipe(
          {
            resource: TE.right(command.resource(input)),
            resourceState: deps.getResourceEvents(command.resource(input)),
            input: TE.right(input),
            actor: TE.right(actor),
          },
          sequenceS(TE.ApplyPar)
        )
      ),
      // Command.process has 2 jobs:
      //  1. To actually create the event
      //  2. To check if the event should be created.
      //
      // Throughout this text 'user' refers to the consumer of this service. It doesn't necessarily mean a human.
      //
      // The idea of this code base is to use the CQRS pattern and following this we want command.process to do as little checking of
      // business rules / other context as possible. Essentially all checking of buisness rules such as 'does this piece of equipment
      // I'm trying to edit exist' should be done on the read side (the read models). This means that practically command.process
      // should never fail and should always emit an event which is then processed when reading in a way of our choosing (such as
      // by displaying there was a problem).
      //
      // Idempotency:
      // Handling duplicate events so the system has idempotency should be primarily done on the readmodel side however it can also
      // optionally be done on the write side in a cheap 'best effort' approach. This is an example of when command.process might not
      // actually return an event but this can be thought of as it still being 'successful' because no-event is actually correct.
      //
      // Command.process failures
      // There are certain cases however where this level of always-succeed 'purity' isn't practical or could cause issues for example
      // during user setup we don't want 2 users to be created with same user id and this is important enough that we want to strictly
      // enforce this on the write side aswell. In this case command.process can actually 'fail' but we stil do this by emitting an
      // event however instead of a regular event we emit one that has been created specifically for the failure case. This can then
      // be handled by the read models etc. to display it to the user. This prevents us needing to add extra failure handling on the
      // write side because its all deferrred to the read model.
      //
      // Write side locking:
      // This is where persistOrNoOp comes in. persistOrNoOp uses non-blocking concurrency to ensure that events for a given resource
      // are only written by 1 command at a time. In the normal case it is expected that this isn't required because the read model
      // will handle any conflicts however in cases such as the duplicate user id problem above we want a stricter guarantee. In
      // combination with command.process failures the write side locking can be used to effectively enforce exactly what is written
      // to the events with a race condition handled by making the command a no-op.
      // In future we can expand the handling of a detected write conflict by re-attempting the command again with the new state until
      // the conflict is resolved. This would open up the ability for the command to raise a proper Failure 'event' as described above
      // if the conflict can't be automatically resolved.
      //
      // Optimisations / notes:
      // - While we actually only require write-side locking in rare cases for now we use it for all commands. The reason is that the
      //    performance overhead is expected to be sufficiently low that we might aswell just use it for everything to minimse the
      //    need to somehow specific which commands require it.
      // - There is currently no mechanism to immediately use a Failure type event and use this to affect the response sent back to
      //    the user. For the time being this intentional as the point of this architecture is to avoid complicated handling on the
      //    write side. If something does happen the user will get a generic error back and then the read-model side is responsible
      //    for displaying the new state based on the failure events that have been stored. It is forseeable that we may decide to
      //    relax this slightly in the future to allow certain failure events to trigger an immediate specific response back to the
      //    user.
      TE.chain(({input, actor}) =>
        applyToResource(deps, command)(input, actor)
      ),
      TE.match(
        failure => {
          deps.logger.error(failure, 'Failed to handle form submission');
          res.status(failure.status).send(oopsPage(failure.message));
        },
        () => res.redirect(successTarget)
      )
    )();
  };
