// The app's brief change log, newest first: one line per feature, written
// for members (what they can now do, not how it was built), dated when it
// first arrived. A later improvement to a feature belongs in its existing
// line, reworded if need be, rather than as a line of its own: nobody needs
// to know a QR code got bigger, but they may care that signs exist. The
// newest entry also appears under the navbar's "About this app" button as
// "Updated N days ago - <headline>", so keep headlines short.
//
// On /about the entries are grouped by subject, so give each the one it
// belongs to; add a subject to `subjects` (and its heading, in the order the
// page shows them) only when none fits.
//
// Update this (and /roadmap) as part of any deploy that ships a significant
// feature or fix.

export const subjects = {
  equipment: 'Equipment and signs',
  training: 'Training',
  tickets: 'Trouble tickets',
  access: 'Door access',
  membership: 'Membership and payments',
  profile: 'Logging in and your profile',
  app: 'The app itself',
} as const;

type Subject = keyof typeof subjects;

type ChangeLogEntry = {
  subject: Subject;
  // ISO date of the deploy.
  date: string;
  headline: string;
};

export const changeLog: ReadonlyArray<ChangeLogEntry> = [
  {
    subject: 'access',
    date: '2026-10-07',
    headline:
      "Door access from the Paxton fob system: super users import its export, see each member's fobs on their profile, and audit who can get in against who should",
  },
  {
    subject: 'tickets',
    date: '2026-10-06',
    headline:
      "Choose what you hear about trouble tickets - yours, your areas', or one machine's - as it happens, daily, weekly or not at all; owners and trainers get a summary about their machines",
  },
  {
    subject: 'membership',
    date: '2026-10-05',
    headline:
      'When a returning member is given a new number, the admin sees how long they were away and decides whether their old training still counts',
  },
  {
    subject: 'equipment',
    date: '2026-10-01',
    headline:
      "Owners can record a machine's equipment guide and risk assessment, and one page shows which machines are still missing either",
  },
  {
    subject: 'membership',
    date: '2026-09-29',
    headline:
      'Super users can see what a member owes and why a payment did not go through, and one page lists every payment that needs following up',
  },
  {
    subject: 'training',
    date: '2026-09-29',
    headline:
      'Trainers can find a member on the quiz-results page and mark them trained without leaving it',
  },
  {
    subject: 'tickets',
    date: '2026-09-29',
    headline:
      "A machine's e-ink display shows whether it's usable, its open tickets and a QR code to its page (trial)",
  },
  {
    subject: 'profile',
    date: '2026-09-25',
    headline:
      'Log in with your member number as well as your email address',
  },
  {
    subject: 'equipment',
    date: '2026-09-24',
    headline:
      'Printable signs for every machine, with a QR code to its page and the points its owners and trainers want you to know',
  },
  {
    subject: 'training',
    date: '2026-09-24',
    headline:
      'Every red machine has a page telling you how to get trained on it, and how far you have got',
  },
  {
    subject: 'membership',
    date: '2026-09-23',
    headline:
      'Members are matched to their Recurly account by billing address or signup address, whatever the capitalisation, and a super user can link an address in one step where neither matches',
  },
  {
    subject: 'equipment',
    date: '2026-09-22',
    headline:
      'Orange and green equipment is listed alongside red; machines can be renamed, re-categorised or retired without losing their training history',
  },
  {
    subject: 'tickets',
    date: '2026-09-21',
    headline:
      'Trouble tickets live in the app: report a problem with a machine, and view and work tickets by area or machine, with email updates and five years of history',
  },
  {
    subject: 'app',
    date: '2026-09-21',
    headline:
      'The roadmap, this change log, and banners for things that need your attention',
  },
  {
    subject: 'training',
    date: '2026-08-25',
    headline:
      "Training records, including quiz results, are kept in the app's own history; owners manage who trains on their machines",
  },
];

export const latestChange = (): ChangeLogEntry => changeLog[0];

// The entries under each subject, newest first, subjects in page order and
// only those with something in them.
export const changeLogBySubject = (): ReadonlyArray<{
  subject: Subject;
  heading: string;
  entries: ReadonlyArray<ChangeLogEntry>;
}> =>
  (Object.keys(subjects) as ReadonlyArray<Subject>)
    .map(subject => ({
      subject,
      heading: subjects[subject],
      entries: changeLog.filter(entry => entry.subject === subject),
    }))
    .filter(group => group.entries.length > 0);
