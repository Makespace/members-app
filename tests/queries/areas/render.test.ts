/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/areas/render';
import {ViewModel} from '../../../src/queries/areas/view-model';
import {Equipment} from '../../../src/read-models/shared-state/return-types';
import {EmailAddress, UserId} from '../../../src/types';
import { fa } from '@faker-js/faker';

const areaId = '11111111-1111-4111-8111-111111111111' as UUID;
const equipmentId = '22222222-2222-4222-8222-222222222222' as UUID;
const ownerEmail = 'owner@example.com' as EmailAddress;
const signedAt = new Date('2025-01-02T12:00:00.000Z');

const equipment = {
  id: equipmentId,
  name: 'Laser Cutter',
  trainingSheetId: O.none,
  trainers: [],
  trainedMembers: [],
  area: {
    id: areaId,
    name: 'Laser Area',
    email: O.none,
  },
} satisfies Equipment;

const area = {
  id: areaId,
  name: 'Laser Area',
  email: O.some('laser@example.com' as EmailAddress),
  equipment: [equipment],
  owners: [
    {
      userId: '33333333-3333-4333-8333-333333333333' as UserId,
      memberNumber: 123,
      pastMemberNumbers: [],
      primaryEmailAddress: ownerEmail,
      name: O.some('Area Owner'),
      agreementSigned: O.some(signedAt),
      ownershipRecordedAt: new Date('2024-01-01T00:00:00.000Z'),
      markedOwnerBy: O.none,
      isActiveOwner: true,
      reasons: [],
      trainingsByQuarter: [
        {label: 'Q4 2025', count: 0},
        {label: 'Q1 2026', count: 0},
        {label: 'Q2 2026', count: 1},
        {label: 'Q3 2026', count: 2},
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
    expect(page.textContent).not.toContain('Add RED equipment');
    expect(page.textContent).not.toContain('Set mailing list');
    expect(page.textContent).not.toContain('Remove area');
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

  it('shows super users management actions', () => {
    const page = renderPage({
      areas: [area],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: false,
    });

    expect(page.textContent).toContain('Add area of responsibility');
    expect(page.textContent).toContain('Add owner');
    expect(page.textContent).toContain('Add RED equipment');
    expect(page.textContent).toContain('Set mailing list');
    expect(page.textContent).toContain('Remove area');
    expect(page.querySelector(`a[href="/areas/remove-owner?memberNumber=123&areaId=${areaId}"]`)).not.toBeNull();
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

  it('shows inactive owners to normal members as public owner details', () => {
    const page = renderPage({
      areas: [
        {
          ...area,
          owners: [{...area.owners[0], isActiveOwner: false}],
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
          owners: [{...area.owners[0], isActiveOwner: false}],
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

  it('shows the trainings column (with header tooltip) and sparkline for an area with red equipment', () => {
    const page = renderPage({
      areas: [area],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: true,
    });
    expect(page.textContent).toContain('Trainings');
    expect(page.textContent).toContain('Shows trainings completed within this area');
    expect(page.querySelectorAll(".sparkline")).toHaveLength(1);
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

  it('consolidates the member number into a single "Member" column', () => {
    const page = renderPage({
      areas: [area],
      canManageAreas: true,
      canSeeOwnerPrivateDetails: true,
      canSeeTrainings: true,
    });
    const tableHeaders = Array.from(page.querySelectorAll("th")).map(node => node.textContent);

    expect(tableHeaders).toContain('Member');
    expect(tableHeaders).not.toContain('Member Number');
    expect(page.textContent).toContain('Owen Owner');
    expect(page.textContent).toContain('/member/4150/');
  });

  it('lists inactive owners with reason chips in a collapsible section', () => {
    const page = renderPage({
      areas: [{
        ...area,
        owners: [{
          ...area.owners[0],
          isActiveOwner: false,
          reasons: ['cancelled-in-term', 'past-due'],
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
