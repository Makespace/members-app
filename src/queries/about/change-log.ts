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
