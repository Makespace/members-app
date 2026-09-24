import {html} from '../../types/html';
import {done, heading, inProgress, timeline, todo} from '../../templates/timeline';

export const render = () => html`
  <div class="stack">
    <h1>Roadmap</h1>
    <p>
      This page lists what we're planning to work on next in the members app.
      Filled circles mark improvements that have already shipped; half-filled
      circles are in progress.
    </p>
    <p class="mb-8">
      Have a suggestion, or want to help build any of this?
      <a href="/about#new-contributor">Get in touch via the about page</a>.
    </p>

    ${timeline([
      heading(html`Equipment management`),
      done(html`Ability to remove equipment`),
      done(html`List orange and green equipment in the app, alongside the
      training-managed red equipment`),
      done(html`Change a machine's sticker category without losing its
      training history`),
      todo(html`Record PAT testing against equipment: asset number, class, who
      tested it, the date, the result and when it's next due`),

      heading(html`Event timeline data migrations`, {done: true}),
      done(html`Bring training quiz results into the event timeline`),
      done(html`Bring trouble tickets into the event timeline`),

      heading(html`Trouble ticket management in the app`, {done: true}),
      done(html`View trouble tickets in the app`),
      done(html`Set the status of a trouble ticket in the app (todo, in
      progress, resolved, parked, needs help)`),
      done(html`Email owners and ticket submitters when a ticket's status
      changes`),
      done(html`Match tickets to their equipment or area, even when the form
      names them differently`),
      done(html`Report a problem from inside the app, picking the machine from
      a list instead of typing its name`),
      done(html`Printable signs for each machine: its name, what its colour
      means, and QR codes for learning about it, getting trained on it, and
      reporting a problem`),
      todo(html`Let members follow the tickets they've reported`),

      heading(html`Notifications`, {done: true}),
      done(html`Banners at the top of the app for events and things that need
      your attention, targetable at owners or specific areas`),

      heading(html`Managing member emails in the app`),
      inProgress(html`Bring the management mailbox into the app so managers
      can read member email there`),
      todo(html`Create trouble tickets directly from emails`),
      todo(html`Reply to member emails from the app using response
      templates`),

      heading(html`Making the app more useful for owners`),
      done(html`Sort the areas page so areas you own appear at the top`),
      done(html`Move admin options into a dropdown, rather than always
      visible`),
      todo(html`Member search bars should match on name, email, or member
      number`),

      heading(html`Owner's agreement`),
      done(html`Add a call-to-action to the app so owners are aware if they
      haven't read and acknowledged the agreement`),
      inProgress(html`Create a new owner's agreement that is up-to-date and
      readable`),
      todo(html`Allow owners to re-read the agreement after they've signed
      it`),
      todo(html`Prompt all owners to read and acknowledge it`),

      heading(html`Training record integrity`),
      todo(html`Dual confirmation for marking someone as trained: the trainer
      marks them as trained, then the trainee confirms by email that they were
      trained satisfactorily`),
      todo(html`Filter inactive members out of the 'awaiting training'
      lists`),
      todo(html`Remove 'trained' status for people who haven't been members
      for a while, or who have been banned`),

      heading(html`Increase awareness of the owners system`),
      todo(html`Create area owner team summary pages that can display on
      screens in Makespace`),

      heading(html`Determining who the active owners are`),
      done(html`Flag owners as inactive when they are no longer members`),
      done(html`View which owners are actively training members`),
      todo(html`View which owners are actively responding to trouble
      tickets`),
      todo(html`Flag owners as inactive based on fob data (people who haven't
      been into Makespace in a while)`),
      todo(html`Flag owners as inactive if they haven't signed the owner's
      agreement`),

      heading(html`Making it easier for members to get trained`),
      done(html`Show who the active trainers are`),
      done(html`Show when the last trainings were`),
      done(html`A page per machine showing the steps to being trained on it,
      and how far you have got`),
      done(html`Record each machine's equipment guide link, so its sign and
      training page point at the real page rather than a guess`),
      done(html`Check those links daily, and flag the ones that stop
      answering before a sign is printed with them`),
      todo(html`Training scheduling in the app`),

      heading(html`Fob-based access control`),
      todo(html`Set fob access to machines based on who has training — this
      needs the app to talk to the fob system, alongside a training push`),
      todo(html`Show a log of who's using machines`),
    ])}
  </div>
`;
