// The app's brief change log, newest first. One line per significant change,
// written for members (what they can now do, not how it was built). The
// newest entry also appears under the navbar's "About this app" button as
// "Updated N days ago - <headline>", so keep headlines short.
//
// Update this (and /roadmap) as part of any deploy that ships a significant
// feature or fix.

type ChangeLogEntry = {
  // ISO date of the deploy.
  date: string;
  headline: string;
};

export const changeLog: ReadonlyArray<ChangeLogEntry> = [
  {
    date: '2026-10-07',
    headline:
      "Super users can record a member's Paxton fobs (fob id and access level) on their profile, as a first step towards syncing with the door system",
  },
  {
    date: '2026-10-06',
    headline:
      'Choose what you hear about trouble tickets - the ones you reported, the areas you look after, or a single machine - as it happens, daily, weekly, or not at all',
  },
  {
    date: '2026-10-06',
    headline:
      'Owners and trainers now get a summary of what was reported about their machines, and taking on a machine starts the emails that go with it',
  },
  {
    date: '2026-10-05',
    headline:
      "When a returning member is given a new number, the admin sees how long they were away (from their Recurly subscriptions) and confirms whether their old training still counts - it lapses after 6 months away",
  },
  {
    date: '2026-10-05',
    headline:
      'The areas page now loads much faster, even with thousands of members on the books',
  },
  {
    date: '2026-10-01',
    headline:
      'One page shows which machines are missing an equipment guide or a risk assessment, and lets a super-user fill the gaps without leaving it',
  },
  {
    date: '2026-10-01',
    headline:
      "A machine's page can now link to its risk assessment, recorded by an owner of its area",
  },
  {
    date: '2026-09-30',
    headline:
      'Admins can rename a machine - the name it had before keeps matching trouble tickets, and its training records are unaffected',
  },
  {
    date: '2026-09-30',
    headline:
      'Super-users can see every membership payment that may need following up on one page, instead of opening members one at a time',
  },
  {
    date: '2026-09-30',
    headline:
      "A member's page now leads with whether they owe anything, showing only the invoices that still need chasing - the full history has a page of its own",
  },
  {
    date: '2026-09-30',
    headline:
      'A member with no training and no areas gets a plain note rather than a table of headings with nothing under it',
  },
  {
    date: '2026-09-29',
    headline:
      "A machine's open trouble tickets can now be shown on an e-ink display mounted on it (trial)",
  },
  {
    date: '2026-09-29',
    headline:
      "Super-users can see a member's invoices, and why an unpaid one has not gone through",
  },
  {
    date: '2026-09-29',
    headline:
      'Trainers can find a member by number, name or email on the quiz-results page and mark them trained without leaving it',
  },
  {
    date: '2026-09-25',
    headline:
      'Log in with your member number as well as your email address - the link still goes to the address we hold for you',
  },
  {
    date: '2026-09-25',
    headline:
      'Open the trouble tickets for one machine from its page, and widen to its area or everything from there',
  },
  {
    date: '2026-09-24',
    headline:
      "Super-users can change a machine's sticker category in the app, keeping its training records either way",
  },
  {
    date: '2026-09-24',
    headline:
      'Equipment guide links are checked daily, so a sign is never printed with a code that leads nowhere',
  },
  {
    date: '2026-09-24',
    headline:
      "Owners can record each machine's equipment guide link, which its sign and training page then use",
  },
  {
    date: '2026-09-24',
    headline:
      'Every red machine now has a page telling you how to get trained on it, and how far you have got',
  },
  {
    date: '2026-09-24',
    headline:
      'Printable signs for every machine, with QR codes for its guide, its trainers, and its trouble tickets',
  },
  {
    date: '2026-09-23',
    headline:
      'Fixed members showing as having no membership data when their Recurly email differed only in capitalisation',
  },
  {
    date: '2026-09-23',
    headline:
      'Report a problem with a machine from inside the app, and get an email confirming it',
  },
  {
    date: '2026-09-22',
    headline:
      'Orange and green equipment can now be listed in the app, not just training-managed red equipment',
  },
  {
    date: '2026-09-21',
    headline: 'Added the roadmap page',
  },
  {
    date: '2026-09-21',
    headline: 'Added notification banners for events and actions needed',
  },
  {
    date: '2026-09-21',
    headline:
      'Added trouble ticket support: view and work tickets by area, with email updates and five years of history',
  },
  {
    date: '2026-09-01',
    headline: 'Owners can remove trainers from equipment',
  },
  {
    date: '2026-08-25',
    headline: "Training quiz results now live in the app's event timeline",
  },
  {
    date: '2026-08-03',
    headline: 'Equipment can be retired without losing its training history',
  },
];

export const latestChange = (): ChangeLogEntry => changeLog[0];
