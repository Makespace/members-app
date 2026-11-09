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
      heading: 'Equipment responsibilities',
      changes: [
        {
          summary: html`Training now includes keeping it in line with risk
          assessments, and supporting members' skills after they're
          trained.`,
          after: html`…keep it up to date and in line with relevant
            guidelines<mark
              >, including risk assessments. Facilitate skills development for
              members after they're trained.</mark
            >`,
        },
        {
          summary: html`New: revoking training if necessary. This was always
          the rule; now it's written down.`,
          after: html`<mark
            >Owners have the right and the responsibility to revoke the training
            of members who are misusing equipment (using the equipment in a
            dangerous or damaging way). The directors can support if
            necessary.</mark
          >`,
        },
        {
          summary: html`"Maintain" is now "Maintenance", and includes
          responding to trouble tickets.`,
          before: html`<strong><del>Maintain</del></strong> - Keep your
            machines running and safe.`,
          after: html`<strong><mark>Maintenance</mark></strong> - Ensure
            equipment is functional and safe.
            <mark
              >Respond to trouble tickets - this is the mechanism by which
              members let owners know there are issues with machines.</mark
            >`,
        },
        {
          summary: html`"Equipment area clean, clear and tidy" is no longer
          its own item; tidiness is now part of encouraging community.`,
          before: html`<del
            ><strong>Equipment area clean, clear and tidy</strong> - Keep the
            area around the machine clear of obstructions, keep tooling tidy,
            and clean around it well.</del
          >`,
          after: html`<strong>Encourage community</strong> - …
            <mark>Enable and encourage owners to keep equipment tidy and
            clean.</mark>`,
        },
        {
          summary: html`Being a point of contact now covers Discord as well as
          Google Groups.`,
          before: html`Respond to member <del>emails</del> on Google
            Groups.`,
          after: html`Respond to member <mark>communications</mark> on Google
            Groups <mark>&amp; Discord</mark>.`,
        },
        {
          summary: html`"Champion good working practices" was dropped from
          encouraging community.`,
          before: html`Help grow a friendly community of members around your
            equipment, <del>champion good working practices,</del> and
            encourage members to become owners.`,
        },
      ],
    },
    {
      heading: 'Area responsibilities',
      changes: [
        {
          summary: html`The "What is an area?" box adds that decisions in an
          area can affect each other, and should be made together.`,
          after: html`<mark
              >Decisions about one equipment/system have the potential to
              affect other equipment/systems within their area.</mark
            >
            … e.g. the band saw is in the secure workshop.
            <mark
              >Decisions that band saw owners make may impact other
              users/owners of the secure workshop - these decisions should be
              made collectively.</mark
            >`,
        },
        {
          summary: html`Coordination now asks owners to aim for one event per
          six-month term.`,
          after: html`…communication between owners within an area.
            <mark
              >Aim to put on an event for your area at least once in your six
              month owner tenure. Examples: Leather Together, Pi Club, Wood
              Club.</mark
            >`,
        },
        {
          summary: html`New: nominating new owners. This was always the rule;
          now it's written down.`,
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
          summary: html`The six activity categories are replaced by a short
          self-check against the responsibilities.`,
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
    {
      heading: 'Resources',
      changes: [
        {
          summary: html`The promise that Makespace will help make proposals
          happen was dropped.`,
          before: html`Owners can submit proposals for improvements to your
            equipment or the space as a whole<del
              >, where needed, and Makespace will help make it happen</del
            >.`,
        },
      ],
    },
    {
      heading: 'Signing',
      changes: [
        {
          summary: html`When signing in the app, owners pick at least one
          responsibility they're interested in taking on, for their equipment
          and for their area.`,
        },
      ],
    },
  ],
};
