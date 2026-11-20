// The topics in the owner's guide, in the order the guide gives them, each
// with the headings within it: its title in the text, and a shorter one for
// the contents. The cards on the owner page and the guide's
// contents link to these, so the anchors live in one place.
export const guideSections = [
  {
    id: 'purchasing',
    icon: 'fa-money-bill-1',
    title: 'Purchase areas',
    summary: 'How to buy things for your area and track your budget.',
    subsections: [
      {
        id: 'yearly-allowances',
        title: 'Yearly allowances',
        contents: 'Yearly allowances',
      },
      {
        id: 'allowance-extensions',
        title: 'Requesting an extension to the yearly allowance',
        contents: 'Extensions',
      },
      {
        id: 'purchasing-decisions',
        title: 'How are purchasing decisions made and actioned?',
        contents: 'Purchase Requests',
      },
      {
        id: 'simple-purchases',
        title: 'Simple Purchases',
        contents: 'Simple Purchases',
      },
      {
        id: 'proposals',
        title: 'Purchase Requests that need a Proposal',
        contents: 'Proposals',
      },
    ],
  },
  {
    id: 'training',
    icon: 'fa-calendar-check',
    title: 'Training',
    summary: 'How to find out who needs training and arrange a session.',
    subsections: [],
  },
  {
    id: 'trouble-tickets',
    icon: 'fa-flag',
    title: 'Trouble tickets',
    summary: "How to see what equipment needs fixing and who's working on it.",
    subsections: [],
  },
] as const;

export type GuideSection = (typeof guideSections)[number];

export type SubsectionId = GuideSection['subsections'][number]['id'];

export const guidePath = (section: GuideSection) =>
  `/owners-guide#${section.id}`;
