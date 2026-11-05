// The topics in the owner's guide, in the order the guide gives them, each
// with the headings within it. The cards on the owner page and the guide's
// contents link to these, so the anchors live in one place.
export const guideSections = [
  {
    id: 'purchasing',
    icon: 'fa-money-bill-1',
    title: 'Purchase areas',
    summary: 'How to buy things for your area and track your budget.',
    subsections: [
      {
        id: 'purchasing-decisions',
        title: 'How are purchasing decisions made and actioned?',
      },
      {id: 'simple-purchases', title: 'Simple Purchases'},
      {id: 'proposals', title: 'Purchase Requests that need a Proposal'},
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
