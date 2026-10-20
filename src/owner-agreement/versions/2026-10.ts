import {html} from '../../types/html';
import {AgreementPage} from './types';

// The October 2026 agreement. It's read one page at a time (see
// sign-owner-agreement-form), so each page is a short, self-contained section
// with its own heading.
export const pages: ReadonlyArray<AgreementPage> = [
  {
    label: 'Welcome',
    body: html`
      <p>
        Thank you so much for stepping up to become an owner at Makespace!
        People like you are the reason Makespace works the way it does: a
        member-led, member-run, organically evolving organisation that enables
        people to express themselves creatively and make stuff.
      </p>

      <p>
        Owning is a great opportunity to shape your area, and Makespace as a
        whole, towards what you and other members feel is important.
      </p>

      <h2>What are the responsibilities of owners?</h2>
      <p>Your responsibilities come in two layers:</p>
      <ul>
        <li>
          Specific equipment (e.g. the band saw) or system(s) (e.g. member
          inductions)
        </li>
        <li>The <strong>area</strong> that equipment/system belongs to.</li>
      </ul>

      <p>
        Please note that owners share the work between them. Everyone has
        their own individual strengths and things they want to focus on. No one
        is expected to cover all of these responsibilities on their own.
      </p>

      <p>
        <em
          >And remember: owners are members too! All the usual member
          responsibilities, like clearing up after yourself, working safely and
          looking out for others, still apply.</em
        >
      </p>
    `,
  },
  {
    label: 'Your equipment',
    body: html`
      <h2>Your responsibilities for equipment you're an owner of:</h2>
    `,
    choices: {
      name: 'equipment',
      responsibilities: [
        {
          value: 'training',
          icon: 'fa-comments',
          title: 'Training',
          description: html`Deliver training so members can use equipment
          safely, and keep it up to date and in line with relevant guidelines,
          including risk assessments. Facilitate skills development for members
          after they're trained.`,
        },
        {
          value: 'revoking-training',
          icon: 'fa-circle-xmark',
          title: 'Revoking training if necessary',
          description: html`Owners have the right and the responsibility to
          revoke the training of members who are misusing equipment (using the
          equipment in a dangerous or damaging way). The directors can support
          if necessary.`,
        },
        {
          value: 'maintenance',
          icon: 'fa-life-ring',
          title: 'Maintenance',
          description: html`Ensure equipment is functional and safe. Respond to
          trouble tickets - this is the mechanism by which members let owners
          know there are issues with machines.`,
        },
        {
          value: 'stock',
          icon: 'fa-clipboard',
          title: 'Manage stock',
          description: html`Look after your equipment's stock and inventory.`,
        },
        {
          value: 'point-of-contact',
          icon: 'fa-envelope',
          title: 'Be a point of contact',
          description: html`Respond to member communications on Google Groups
          &amp; Discord.`,
        },
        {
          value: 'community',
          icon: 'fa-face-smile',
          title: 'Encourage community',
          description: html`Help grow a friendly community of members around
          your equipment, and encourage members to become owners. Enable and
          encourage owners to keep equipment tidy and clean.`,
        },
        {
          value: 'documentation',
          icon: 'fa-file-lines',
          title: 'Documentation',
          description: html`Keep the risk assessment and safety sheet up to
          date.`,
        },
      ],
    },
  },
  {
    label: 'Your area',
    body: html`
      <h2>Your responsibilities for the area your equipment belongs to:</h2>

      <div class="callout">
        <p><strong>What is an area?</strong></p>
        <p>
          The set of related equipment/systems and the owners responsible for
          them. Decisions about one equipment/system have the potential to
          affect other equipment/systems within their area.
        </p>
        <p>
          An area is often a physical space, but it doesn't have to be. For
          example, the 3D printers are an area even though they're split across
          multiple locations within Makespace.
        </p>
        <p>
          <em
            >e.g. the band saw is in the secure workshop. Decisions that band
            saw owners make may impact other users/owners of the secure
            workshop - these decisions should be made collectively.</em
          >
        </p>
      </div>
    `,
    choices: {
      name: 'area',
      responsibilities: [
        {
          value: 'documentation',
          icon: 'fa-file-lines',
          title: 'Documentation',
          description: html`Keep the area's risk assessments up to date.`,
        },
        {
          value: 'budget',
          icon: 'fa-money-bill-1',
          title: 'Budget',
          description: html`Manage the area's budget.`,
        },
        {
          value: 'community',
          icon: 'fa-face-smile',
          title: 'Encourage community',
          description: html`Help the area's members and owners feel like one
          community, and encourage members to become owners.`,
        },
        {
          value: 'coordination',
          icon: 'fa-comments',
          title: 'Coordination',
          description: html`Facilitate and/or participate in meetups and
          communication between owners within an area. Aim to put on an event
          for your area at least once in your six month owner tenure.
          Examples: Leather Together, Pi Club, Wood Club.`,
        },
        {
          value: 'nominating',
          icon: 'fa-user',
          title: 'Nominating new owners',
          description: html`A new owner needs to be nominated by an existing
          owner before they can be approved by the board.`,
        },
      ],
    },
  },
  {
    label: 'Resources',
    body: html`
      <h2>What resources are available to owners?</h2>
      <ul>
        <li>
          Access to the stock room - secure storage areas for stock and
          replacement parts.
        </li>
        <li>
          The management team is your point of contact for any functional
          changes or issues, and there to help more generally.
        </li>
        <li>
          Owners can submit proposals for improvements to your equipment or the
          space as a whole.
        </li>
        <li>Capital on tap and invoicing are available for purchases.</li>
      </ul>
    `,
  },
  {
    label: 'Being active',
    body: html`
      <h2>Owners agree to be active.</h2>
      <p>
        We ask owners to agree to a six-month commitment. At the end of this
        period, owners are asked to renew their commitment, if they want to
        continue, by signing a new owner's agreement. Owners should only renew
        their agreement if they feel they are active.
      </p>
      <p>
        In cases where owners are clearly absent or not meeting their
        responsibilities, the directors of Makespace may step in to prevent the
        renewal of an owner's agreement, or remove an existing owner.
      </p>

      <h3>How do I know if I'm an active owner or not?</h3>
      <ul class="checklist">
        <li>
          <span class="checkbox" aria-hidden="true"></span>
          <span>Are you a Makespace member?</span>
        </li>
        <li>
          <span class="checkbox" aria-hidden="true"></span>
          <span>Have you agreed to be an owner?</span>
        </li>
        <li>
          <span class="checkbox" aria-hidden="true"></span>
          <span
            >Have you fulfilled one or more of the owner responsibilities
            identified earlier in this agreement during your six-month post as
            an owner?</span
          >
        </li>
      </ul>
      <p>If yes, you're an active owner.</p>
      <p>
        <em
          >Note: everyone contributes in different ways, and some of those are
          easier to measure than others, but they all provide value. The idea
          here is not to limit owner activities to prescriptive categories.</em
        >
      </p>
    `,
  },
  {
    label: 'Liability',
    body: html`
      <h2>Owners are not individually liable for member safety.</h2>
      <p>
        The Directors of Makespace Cambridge Ltd. are ultimately responsible for
        the safety, security and sustainability of Makespace. Your role as an
        owner is to help deliver that to the membership day to day.
      </p>
      <p>
        Owners are not individually liable for the safety of members at
        Makespace, but are rather a collective contributor to the communal
        functioning of the space.
      </p>
    `,
  },
];
