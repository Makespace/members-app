/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/areas/render';
import {
  EquipmentViewModel,
  ViewModel,
} from '../../../src/queries/areas/view-model';
import {EmailAddress} from '../../../src/types';
import { getSomeOrFail } from '../../helpers';
import { html } from '../../../src/types/html';

const areaId = '11111111-1111-4111-8111-111111111111' as UUID;
const equipmentId = '22222222-2222-4222-8222-222222222222' as UUID;
const ownerEmail = 'owner@example.com' as EmailAddress;
const signedAt = new Date('2025-01-02T12:00:00.000Z');

const equipment = {
  id: equipmentId,
  name: 'Laser Cutter',
  category: 'red' as const,
  areaCategoryId: O.none,
  trainingsByQuarter: [
    {label: html`Q4 2025`, count: 1},
    {label: html`Q1 2026`, count: 0},
    {label: html`Q2 2026`, count: 3},
    {label: html`Q3 2026`, count: 2},
  ],
} satisfies EquipmentViewModel;

const secondEquipmentId = '44444444-4444-4444-8444-444444444444' as UUID;

const secondEquipment = {
  ...equipment,
  id: secondEquipmentId,
  name: 'CNC Router',
} satisfies EquipmentViewModel;

const area = {
  id: areaId,
  name: 'Laser Area',
  email: O.some('laser@example.com' as EmailAddress),
  equipment: [equipment],
  equipmentCategories: [],
  canManage: false,
  owners: [
    {
      memberNumber: 123,
      primaryEmailAddress: ownerEmail,
      name: O.some('Area Owner'),
      agreementSigned: O.some(signedAt),
      verdict: O.some({isActiveOwner: true, reasons: []}),
      trainingsByQuarter: [
        {label: html`Q4 2025`, count: 0},
        {label: html`Q1 2026`, count: 0},
        {label: html`Q2 2026`, count: 1},
        {label: html`Q3 2026`, count: 2},
      ],
    },
  ],
} satisfies ViewModel['areas'][number];


const renderPage = (viewModel: ViewModel): HTMLBodyElement => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return body;
};

const normalizedText = (page: HTMLElement): string =>
  page.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('areas render', () => {
  it('shows normal members equipment and only public owner details', () => {
    const page = renderPage({
      areas: [area],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: false,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain('Areas');
    expect(page.querySelector(`#area-${areaId}`)).not.toBeNull();
    expect(page.querySelector(`a[href="/equipment/${equipmentId}"]`)!.textContent).toContain('Laser Cutter');
    expect(page.textContent).toContain('Area Owner');
    expect(page.textContent).toContain('123');
    expect(page.textContent).not.toContain(ownerEmail);
    expect(page.textContent).not.toContain('Agreement Signed');
    expect(page.textContent).not.toContain('Add owner');
    expect(page.textContent).not.toContain('Add equipment');
    expect(page.textContent).not.toContain('Set mailing list');
    expect(page.textContent).not.toContain('Remove area');
    expect(page.textContent).not.toContain('Manage area');
  });

  it('shows owners private owner details without management actions', () => {
    const page = renderPage({
      areas: [area],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain(ownerEmail);
    expect(page.textContent).toContain('Agreement Signed');
    expect(page.textContent).toContain('2 Jan 25');
    expect(page.textContent).not.toContain('Ask to sign');
    expect(page.textContent).not.toContain('Add owner');
    expect(page.textContent).not.toContain('Remove area');
  });

  it('shows super users a Manage area button beside each area title instead of a row of actions', () => {
    const page = renderPage({
      areas: [{...area, canManage: true}],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain('Add area of responsibility');
    const manage = page.querySelector(
      `#area-${areaId} .area-heading a[href="/areas/manage?area=${areaId}"]`
    );
    expect(manage?.textContent).toContain('Manage area');
    expect(page.textContent).not.toContain('Add owner');
    expect(page.textContent).not.toContain('Bulk-add');
    expect(page.textContent).not.toContain('Set mailing list');
    expect(page.textContent).not.toContain('Remove area');
    expect(page.querySelector(`a[href="/areas/remove-owner?memberNumber=123&areaId=${areaId}"]`)).not.toBeNull();
  });

  it('shows an owner of the area its Manage area button', () => {
    const page = renderPage({
      areas: [{...area, canManage: true}],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: false,
    });

    expect(
      page.querySelector(`a[href="/areas/manage?area=${areaId}"]`)
    ).not.toBeNull();
  });

  describe('equipment categories', () => {
    const wheelsId = '55555555-5555-4555-8555-555555555555' as UUID;
    const chainsId = '66666666-6666-4666-8666-666666666666' as UUID;
    const emptyId = '77777777-7777-4777-8777-777777777777' as UUID;
    const item = (
      id: string,
      name: string,
      category: EquipmentViewModel['category'],
      areaCategoryId: O.Option<UUID>
    ): EquipmentViewModel => ({
      id: id as UUID,
      name,
      category,
      areaCategoryId,
      trainingsByQuarter: [],
    });
    let page: HTMLBodyElement;

    beforeEach(() => {
      page = renderPage({
        areas: [
          {
            ...area,
            equipmentCategories: [
              {id: wheelsId, name: 'Wheels'},
              {id: chainsId, name: 'Chains'},
              {id: emptyId, name: 'Nothing here'},
            ],
            equipment: [
              item('a1111111-1111-4111-8111-111111111111', 'Truing Stand', 'orange', O.some(wheelsId)),
              item('a2222222-2222-4222-8222-222222222222', 'Spoke Meter', 'orange', O.some(wheelsId)),
              item('a3333333-3333-4333-8333-333333333333', 'Tyre Levers', 'green', O.some(wheelsId)),
              item('a4444444-4444-4444-8444-444444444444', 'Chain Whip', 'green', O.some(chainsId)),
              item('a5555555-5555-4555-8555-555555555555', 'Floor Pump', 'green', O.none),
            ],
          },
        ],
        canManageAreas: false,
        canSeeOwnerPrivateDetails: false,
        canSeeTrainings: false,
      });
    });

    const groups = () =>
      [...page.querySelectorAll('details.area-eq-group')].map(group => ({
        name: group.querySelector('.area-eq-group__name')?.textContent?.trim(),
        counts: normalizedText(
          group.querySelector('.area-eq-group__counts') as HTMLElement
        ),
        items: [...group.querySelectorAll('.equipment-with-sparkline')].map(
          equipmentItem => normalizedText(equipmentItem as HTMLElement)
        ),
        open: group.hasAttribute('open'),
      }));

    it('shows one collapsed section per category in use, then the uncategorised under Other', () => {
      expect(groups().map(group => group.name)).toStrictEqual([
        'Wheels',
        'Chains',
        'Other',
      ]);
      expect(groups().every(group => !group.open)).toBe(true);
    });

    it('tallies each section by sticker colour, leaving out colours it has none of', () => {
      expect(groups()[0].counts).toBe('Orange:2 Green:1');
      expect(groups()[1].counts).toBe('Green:1');
    });

    it('lists the equipment inside its section', () => {
      expect(groups()[0].items).toStrictEqual([
        'Truing Stand',
        'Spoke Meter',
        'Tyre Levers',
      ]);
      expect(groups()[2].items).toStrictEqual(['Floor Pump']);
    });

    it('lists the equipment flat for an area without categories', () => {
      const flat = renderPage({
        areas: [area],
        canManageAreas: false,
        canSeeOwnerPrivateDetails: false,
        canSeeTrainings: false,
      });

      expect(flat.querySelector('details.area-eq-group')).toBeNull();
      expect(flat.querySelectorAll('.equipment-with-sparkline')).toHaveLength(1);
    });
  });

  it('shows a clear empty equipment message', () => {
    const page = renderPage({
      areas: [{...area, equipment: []}],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: false,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain('No equipment currently assigned to this area.');
  });

  it('puts each piece of equipment on its own line', () => {
    const page = renderPage({
      areas: [{...area, equipment: [equipment, secondEquipment]}],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: false,
      canSeeTrainings: false,
    });

    const equipmentItems = page.querySelectorAll(
      `#area-${areaId} .equipment-with-sparkline`
    );

    expect(equipmentItems).toHaveLength(2);
    expect(equipmentItems[0]?.textContent).toContain('Laser Cutter');
    expect(equipmentItems[1]?.textContent).toContain('CNC Router');
  });

  it('shows inactive owners to normal members as public owner details', () => {
    const page = renderPage({
      areas: [
        {
          ...area,
          owners: [{...area.owners[0], verdict: O.some({isActiveOwner: false, reasons: []})}],
        },
      ],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: false,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain('Area Owner');
    expect(page.textContent).toContain('123');
    expect(page.textContent).not.toContain(ownerEmail);
    expect(normalizedText(page)).not.toContain(
      "This area doesn't have any owners currently - email owners@makespace.org to get involved!"
    );
    expect(page.textContent).not.toContain(
      'No active owners — see inactive owners below.'
    );
  });

  it("shows a public get-involved message when an area doesn't have any owners", () => {
    const page = renderPage({
      areas: [
        {
          ...area,
          owners: [],
        },
      ],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: false,
      canSeeTrainings: false,
    });

    expect(normalizedText(page)).toContain(
      "This area doesn't have any owners currently - email owners@makespace.org to get involved!"
    );
  });

  it("shows the public get-involved message to non-super users who can see owner private details", () => {
    const page = renderPage({
      areas: [
        {
          ...area,
          owners: [],
        },
      ],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: false,
    });

    expect(normalizedText(page)).toContain(
      "This area doesn't have any owners currently - email owners@makespace.org to get involved!"
    );
  });

  it('keeps the inactive-owner hint for super users', () => {
    const page = renderPage({
      areas: [
        {
          ...area,
          owners: [{...area.owners[0], verdict: O.some({isActiveOwner: false, reasons: []})}],
        },
      ],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain(
      'No active owners — see inactive owners below.'
    );
  });

  it('shows unevaluated owners to ordinary members without a verdict', () => {
    // Ordinary members and area owners receive owners with no verdict at
    // all: the renderer must list them publicly without consulting the
    // active/inactive split, which only super-users see.
    const page = renderPage({
      areas: [
        {
          ...area,
          owners: [{...area.owners[0], verdict: O.none}],
        },
      ],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: false,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain('Area Owner');
    expect(page.textContent).toContain('123');
    expect(page.textContent).not.toContain(ownerEmail);
    expect(normalizedText(page)).not.toContain(
      "This area doesn't have any owners currently - email owners@makespace.org to get involved!"
    );
    expect(page.textContent).not.toContain(
      'No active owners — see inactive owners below.'
    );
    expect(page.textContent).not.toContain('Ask to sign');
  });

  it('shows unevaluated owners with private details without a verdict', () => {
    const page = renderPage({
      areas: [
        {
          ...area,
          owners: [{...area.owners[0], verdict: O.none}],
        },
      ],
      canManageAreas: false,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain(ownerEmail);
    expect(page.textContent).toContain('Agreement Signed');
    expect(page.textContent).not.toContain('Remove area');
  });

  it('shows the trainings column (with header tooltip) and sparkline for an area with red equipment', () => {
    const page = renderPage({
      areas: [area],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: true,
    });
    expect(page.textContent).toContain('Trainings');
    expect(page.textContent).toContain('Shows trainings completed within this area');
    expect(page.querySelectorAll(".sparkline")).toHaveLength(2);
  });

  it('hides the trainings column for an area with no red equipment', () => {
    const page = renderPage({
      areas: [{
        ...area,
        equipment: [],
      }],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: true,
    });
    expect(page.textContent).not.toContain('Shows trainings completed within this area');
    expect(page.querySelectorAll(".sparkline")).toHaveLength(0);
  });

  it('consolidates the member number into a single "Owner" column', () => {
    const page = renderPage({
      areas: [area],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: true,
    });
    const tableHeaders = Array.from(page.querySelectorAll("th")).map(node => node.textContent);

    expect(tableHeaders).toContain('Owner');
    expect(tableHeaders).not.toContain('Member Number');
    expect(page.textContent).toContain(getSomeOrFail(area.owners[0].name));
    expect(page.textContent).toContain(`(${area.owners[0].memberNumber})`);
  });

  it('lists inactive owners with reason chips in a collapsible section', () => {
    const page = renderPage({
      areas: [{
        ...area,
        owners: [{
          ...area.owners[0],
          verdict: O.some({
            isActiveOwner: false,
            reasons: ['cancelled-in-term', 'past-due'],
          }),
        }]
      }],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: true,
    });
    const detailsSections = Array.from(page.querySelectorAll("details"));
    expect(detailsSections).toHaveLength(1);
    expect(detailsSections[0].textContent).toContain('Cancelled – still has access');
    expect(detailsSections[0].textContent).toContain('Payment overdue');
  });
});
