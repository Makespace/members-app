// The topics in the owner's guide, in the order the guide gives them. The
// cards on the owner page link to these, so the anchors live in one place.
export const guideSections = [
  {
    id: 'purchasing',
    icon: 'fa-money-bill-1',
    title: 'Purchase areas',
    summary: 'How to buy things for your area and track your budget.',
  },
  {
    id: 'training',
    icon: 'fa-calendar-check',
    title: 'Training',
    summary: 'How to find out who needs training and arrange a session.',
  },
  {
    id: 'trouble-tickets',
    icon: 'fa-flag',
    title: 'Trouble tickets',
    summary: "How to see what equipment needs fixing and who's working on it.",
  },
] as const;

export type GuideSection = (typeof guideSections)[number];

export const guidePath = (section: GuideSection) =>
  `/owners-guide#${section.id}`;
