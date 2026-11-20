import {html} from '../../types/html';
import {AgreementChanges} from './types';

// What changed between the draft circulated for the Owners' Forum (14 October
// 2026) and the agreement as published. The draft was a document, not a
// version in the app, so this is a written summary rather than a diff. Each
// snippet quotes the agreement: <del> for wording the draft had, <mark> for
// wording that's new.
export const changes: AgreementChanges = {
  comparedWith: "the draft discussed at the Owners' Forum on 14 October 2026",
  groups: [
    {
      heading: 'Naming',
      changes: [
        {
          summary: html`"Practice group" is now "area", the name the app
          already uses.`,
          before: html`Owning is a great opportunity to shape your
            <del>practice group</del>, and Makespace as a whole…`,
          after: html`Owning is a great opportunity to shape your
            <mark>area</mark>, and Makespace as a whole…`,
        },
        {
          summary: html`Responsibilities cover systems as well as equipment,
          such as member inductions.`,
          before: html`Your responsibilities come in two layers: the equipment
            you own, and the practice group that equipment belongs to.`,
          after: html`Specific equipment (e.g. the band saw)
            <mark>or system(s) (e.g. member inductions)</mark>`,
        },
        {
          summary: html`"Store rooms" is now "the stock room".`,
          before: html`Access to <del>the store rooms</del>, secure storage
            areas for stock and replacement parts.`,
          after: html`Access to <mark>the stock room</mark> - secure storage
            areas for stock and replacement parts.`,
        },
        {
          summary: html`"Maintain" is now "Maintenance".`,
          before: html`<strong><del>Maintain</del></strong> - Keep your
            machines running and safe.`,
          after: html`<strong><mark>Maintenance</mark></strong> - Ensure
            equipment is functional and safe.`,
        },
        {
          summary: html`The liability section says "owners are" rather than
          "you are".`,
          before: html`<del>You are</del> not individually liable for the
            safety of members at Makespace…`,
          after: html`<mark>Owners are</mark> not individually liable for the
            safety of members at Makespace…`,
        },
      ],
    },
    {
      heading: 'Responsibilities',
      changes: [
        {
          summary: html`Clarified that "relevant guidelines" for training
          includes risk assessments.`,
          after: html`…keep it up to date and in line with relevant
            guidelines<mark>, including risk assessments</mark>.`,
        },
        {
          summary: html`Clarified that being a point of contact includes
          Google Groups <em>and</em> Discord.`,
          before: html`Respond to member <del>emails</del> on Google
            Groups.`,
          after: html`Respond to member <mark>communications</mark> on Google
            Groups <mark>&amp; Discord</mark>.`,
        },
        {
          kind: 'added',
          tag: 'Training',
          summary: html`Facilitating skills development for members after
          they're trained.`,
          after: html`<mark
            >Facilitate skills development for members after they're
            trained.</mark
          >`,
        },
        {
          kind: 'added',
          tag: 'New',
          summary: html`Revoking training if necessary. This was always the
          case, but it's now included in the agreement.`,
          after: html`<mark
            >Owners have the right and the responsibility to revoke the training
            of members who are misusing equipment (using the equipment in a
            dangerous or damaging way). The directors can support if
            necessary.</mark
          >`,
        },
        {
          kind: 'added',
          tag: 'Maintenance',
          summary: html`Now includes responding to trouble tickets.`,
          after: html`Ensure equipment is functional and safe.
            <mark
              >Respond to trouble tickets - this is the mechanism by which
              members let owners know there are issues with machines.</mark
            >`,
        },
        {
          kind: 'added',
          tag: 'Encourage community',
          summary: html`Now includes enabling and encouraging members to keep
          equipment tidy and clean, rather than considering this a direct
          responsibility of owners.`,
          before: html`<del
            ><strong>Equipment area clean, clear and tidy</strong> - Keep the
            area around the machine clear of obstructions, keep tooling tidy,
            and clean around it well.</del
          >`,
          after: html`<strong>Encourage community</strong> - …
            <mark>Enable and encourage members to keep equipment tidy and
            clean.</mark>`,
        },
        {
          kind: 'added',
          tag: 'New',
          summary: html`Nominating new owners. This was always the case, but
          it's now included in the agreement.`,
          after: html`<mark
            >A new owner needs to be nominated by an existing owner before they
            can be approved by the board.</mark
          >`,
        },
      ],
    },
    {
      heading: 'Being an active owner',
      changes: [
        {
          summary: html`Following the forum, we clarified how renewal works.
          Rather than renewing by "mutual consent" of the owner and the
          directors, owners decide for themselves whether they've been active,
          and the directors can block a renewal or remove an owner.`,
          before: html`Owners are in post for six months at a time, renewed
            <del>by mutual consent between the owner and the directors</del>.`,
          after: html`Owners should only renew their agreement
            <mark>if they feel they are active</mark>. …
            <mark
              >the directors of Makespace may step in to prevent the renewal of
              an owner's agreement, or remove an existing owner.</mark
            >`,
        },
        {
          summary: html`Instead of six activity categories, we ask owners to
          check that they're a Makespace member, that they've agreed to be an
          owner, and that they've fulfilled one or more of the responsibilities
          during their post. And we ask owners to pick the responsibilities
          they'd like to get involved with.`,
          before: html`<del
            >…mainly falls in the following six categories: training members,
            responding to trouble tickets, updating documents, making purchases
            for stock, being active on Google Groups, recruiting/training new
            owners. Owners who fulfil any one of these within a six-monthly
            period are marked as Active Owners.</del
          >`,
          after: html`<mark
            >Have you fulfilled one or more of the owner responsibilities
            identified earlier in this agreement during your six-month post as
            an owner?</mark
          >`,
        },
      ],
    },
  ],
};
