
/**
 * We need to be able to manipulate a virtual dom to render the page for tests.
 * 
 * @jest-environment jsdom
 */

import { queryByText } from '@testing-library/dom';

import * as O from 'fp-ts/Option';

import { render } from '../../../src/queries/equipment/render';
import { ViewModel } from '../../../src/queries/equipment/view-model';
import { Equipment, TrainedMember, TrainerInfo } from '../../../src/read-models/shared-state/return-types';
import { User } from '../../../src/types/user';
import { faker } from '@faker-js/faker';
import { EmailAddress } from '../../../src/types';
import { UUID } from 'io-ts-types';
import { FullQuizResultsForEquipment } from '../../../src/read-models/external-state/equipment-quiz';

describe('Render equipment page', () => {
    const renderPage = (vm: ViewModel) => {
        const rendered = render(vm);
        const body = document.createElement('body');
        body.innerHTML = rendered.body;
        return body;
    };

    const trainer: Readonly<TrainerInfo> = {
        name: O.some(faker.animal.dog()),
        memberNumber: faker.number.int({min: 1}),
        primaryEmailAddress: faker.internet.email() as EmailAddress,
        pastMemberNumbers: [],
        markedTrainerByActor: O.some({
            tag: 'user',
            user: {
                emailAddress: faker.internet.email() as EmailAddress,
                primaryEmailAddress: faker.internet.email() as EmailAddress,
                memberNumber: faker.number.int({min: 1}),
            }
        }),
        trainerSince: faker.date.past(),
    };
    const trainedMember: Readonly<TrainedMember> = {
        name: O.some(faker.animal.dog()),
        memberNumber: faker.number.int({min: 1}),
        primaryEmailAddress: faker.internet.email() as EmailAddress,
        pastMemberNumbers: [],
        markedTrainedByActor: O.some({
            tag: 'user',
            user: {
                memberNumber: trainer.memberNumber,
                emailAddress: trainer.primaryEmailAddress,
                primaryEmailAddress: trainer.primaryEmailAddress,
            }
        }),
        trainedByMemberNumber: O.some(trainer.memberNumber),
        trainedByEmail: O.some(trainer.primaryEmailAddress),
        trainedSince: faker.date.between({from: trainer.trainerSince, to: new Date()}),
        legacyImport: false,
    };

    const equipment: Readonly<Equipment> = {
        id: faker.string.uuid() as UUID,
        name: faker.airline.aircraftType(),
        category: 'red',
        machineNames: [],
        trainers: [
            trainer
        ],
        trainedMembers: [
            trainedMember
        ],
        trainingSheetId: O.some(faker.string.alpha({length: 20})),
        guideUrl: O.none,
        riskAssessmentUrl: O.none,
        learnPoints: [],
        removedAt: O.none,
        area: {
            id: faker.string.uuid() as UUID,
            name: faker.airline.airline().name,
            email: O.some(faker.internet.email() as EmailAddress),
        }
    };
    const quizResults: Readonly<FullQuizResultsForEquipment> = {
        lastQuizSync: O.none,
        membersAwaitingTraining: [],
        unknownMembersAwaitingTraining: [],
        failedQuizes: []
    };
    const quizResultsWithMemberAwaitingTraining: Readonly<FullQuizResultsForEquipment> = {
        ...quizResults,
        membersAwaitingTraining: [{
            memberNumber: faker.number.int({min: 1}),
            name: O.some(faker.animal.dog()),
            pastMemberNumbers: [],
            waitingSince: faker.date.recent(),
        }]
    };
    const findMarkAsTrainedButton = (dom: HTMLElement) => O.fromNullable(queryByText(dom, 'Mark as trained'));
    const findRevokeTrainingButton = (dom: HTMLElement) => O.fromNullable(queryByText(dom, 'Revoke Training'));

    describe('regular member view', () => {
        const regularMember: User = {
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: faker.number.int({min: 1}),
        };
        const memberDetails: Pick<ViewModel, 'isSuperUser' | 'isSuperUserOrOwnerOfArea' | 'user' | 'isSuperUserOrTrainerOfArea'> = {
            isSuperUser: false,
            isSuperUserOrOwnerOfArea: false,
            user: regularMember,
            isSuperUserOrTrainerOfArea: false
        };
        
        const viewmodel: Readonly<ViewModel> = {
            ...memberDetails,
            equipment,
            guideLink: O.none,
            tickets: {active: 0, resolvedRecently: 0},
            training: {activeTrainers: 0, trainingsRecently: 0},
            quizResults: O.some(quizResults)
        };
        let renderedDom: HTMLElement;

        beforeEach(() => {
            renderedDom = renderPage(viewmodel);
        });

        it('cannot see revoke training button', () => {
            expect(findRevokeTrainingButton(renderedDom)).toStrictEqual(O.none);
        });

        // The breadcrumb is where the area lives now, and it is the only
        // place it lives: the same link twice on one screen is noise.
        it('links to the equipment area, from the breadcrumb', () => {
            const toArea = [
                ...renderedDom.querySelectorAll(
                    `a[href="/areas#area-${equipment.area.id}"]`
                ),
            ];

            expect(toArea).toHaveLength(1);
            expect(toArea[0].closest('.eq-breadcrumb')).not.toBeNull();
            expect(toArea[0].textContent).toContain(equipment.area.name);
        });
    });

    describe('super user view', () => {
        const superUser: User = {
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: faker.number.int({min: 1}),
        };
        const memberDetails: Pick<ViewModel, 'isSuperUser' | 'isSuperUserOrOwnerOfArea' | 'user' | 'isSuperUserOrTrainerOfArea'> = {
            isSuperUser: true,
            isSuperUserOrOwnerOfArea: true,
            user: superUser,
            isSuperUserOrTrainerOfArea: true
        };
        
        const viewmodel: Readonly<ViewModel> = {
            ...memberDetails,
            equipment,
            guideLink: O.none,
            tickets: {active: 0, resolvedRecently: 0},
            training: {activeTrainers: 0, trainingsRecently: 0},
            quizResults: O.some(quizResults)
        };
        let renderedDom: HTMLElement;

        beforeEach(() => {
            renderedDom = renderPage(viewmodel);
        });

        // The lists of people are pages of their own; this page links to them
        // with their sizes, so a glance says whether there is anything to do.
        it('links to the people pages, with their counts', () => {
            const links = [...renderedDom.querySelectorAll('a')].map(
                node => node.getAttribute('href') ?? ''
            );

            expect(links).toContain(`/equipment/${equipment.id}/trained-users`);
            expect(links).toContain(`/equipment/${equipment.id}/quiz-results`);
            expect(links).toContain(`/equipment/${equipment.id}/failed-quizzes`);
            expect(renderedDom.textContent).toContain(
                'View currently trained users (1)'
            );
        });

        
    });

    describe('owner view', () => {
        const owner: User = {
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: faker.number.int({min: 1}),
        };

        const viewmodel: Readonly<ViewModel> = {
            isSuperUser: false,
            isSuperUserOrOwnerOfArea: true,
            user: owner,
            isSuperUserOrTrainerOfArea: false,
            equipment,
            guideLink: O.none,
            tickets: {active: 0, resolvedRecently: 0},
            training: {activeTrainers: 0, trainingsRecently: 0},
            quizResults: O.some(quizResultsWithMemberAwaitingTraining)
        };
        let renderedDom: HTMLElement;

        beforeEach(() => {
            renderedDom = renderPage(viewmodel);
        });

        // An owner reads the lists; marking somebody trained is a trainer's
        // job, and that button lives on the page that lists them.
        it('is offered the lists to read', () => {
            const links = [...renderedDom.querySelectorAll('a')].map(
                node => node.getAttribute('href') ?? ''
            );

            expect(links).toContain(`/equipment/${equipment.id}/quiz-results`);
            expect(links).toContain(`/equipment/${equipment.id}/trained-users`);
        });
    });

    describe('trainer view', () => {
        const trainerUser: User = {
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: trainer.memberNumber,
        };

        const viewmodel: Readonly<ViewModel> = {
            isSuperUser: false,
            isSuperUserOrOwnerOfArea: false,
            user: trainerUser,
            isSuperUserOrTrainerOfArea: true,
            equipment,
            guideLink: O.none,
            tickets: {active: 0, resolvedRecently: 0},
            training: {activeTrainers: 0, trainingsRecently: 0},
            quizResults: O.some(quizResultsWithMemberAwaitingTraining)
        };
        let renderedDom: HTMLElement;

        beforeEach(() => {
            renderedDom = renderPage(viewmodel);
        });

        // The lists themselves are a page each now; what a trainer needs from
        // here is the way in, and how many people are waiting.
        it('offers the quiz results and the trained users, with their counts', () => {
            const links = [...renderedDom.querySelectorAll('a')].map(
                node => node.getAttribute('href') ?? ''
            );

            expect(links).toContain(`/equipment/${equipment.id}/quiz-results`);
            expect(links).toContain(`/equipment/${equipment.id}/trained-users`);
            expect(links).toContain(`/equipment/${equipment.id}/failed-quizzes`);
            expect(renderedDom.textContent).toContain(
                'View training quiz results, and mark people as trained (1)'
            );
        });
    });

    describe('orange and green equipment', () => {
        const superUser: User = {
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: faker.number.int({min: 1}),
        };

        const renderWithCategory = (category: 'red' | 'orange' | 'green') =>
            renderPage({
                isSuperUser: true,
                isSuperUserOrOwnerOfArea: true,
                isSuperUserOrTrainerOfArea: true,
                user: superUser,
                equipment: {...equipment, category},
                guideLink: O.none,
            tickets: {active: 0, resolvedRecently: 0},
            training: {activeTrainers: 0, trainingsRecently: 0},
            quizResults: O.some(quizResultsWithMemberAwaitingTraining),
            });

        it('states what the category means', () => {
            expect(renderWithCategory('orange').textContent).toContain(
                'Only use if confident to do so'
            );
            expect(renderWithCategory('green').textContent).toContain(
                'All members & guests'
            );
            expect(renderWithCategory('red').textContent).toContain(
                'Training required before use'
            );
        });

        it('hides trainers, trained members and quiz results, which do not apply', () => {
            const dom = renderWithCategory('orange');
            expect(dom.textContent).not.toContain('Trainers');
            expect(dom.textContent).not.toContain('Currently Trained Users');
            expect(dom.textContent).not.toContain('Training Quiz Results');
        });

        it('hides the training actions but keeps admin retirement', () => {
            const dom = renderWithCategory('green');
            expect(O.isSome(findMarkAsTrainedButton(dom))).toBe(false);
            expect(dom.textContent).not.toContain('Add a trainer');
            expect(dom.textContent).not.toContain('Register training sheet');
            expect(dom.textContent).toContain('Retire equipment');
        });

        it('still shows all of that for red equipment', () => {
            const dom = renderWithCategory('red');
            expect(dom.textContent).toContain('Trainers');
            expect(dom.textContent).toContain('Add a trainer');
        });
    });

});

describe('the equipment guide, when it stopped answering', () => {
    const renderPage = (vm: ViewModel) => {
        const body = document.createElement('body');
        body.innerHTML = render(vm).body;
        return body;
    };

    const withGuide = (reachable: boolean): ViewModel => ({
        user: {
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: faker.number.int({min: 1}),
        },
        isSuperUser: false,
        isSuperUserOrOwnerOfArea: false,
        isSuperUserOrTrainerOfArea: false,
        equipment: {
            id: faker.string.uuid() as UUID,
            name: 'Band Saw',
            category: 'red',
            machineNames: [],
            trainers: [],
            trainedMembers: [],
            trainingSheetId: O.none,
            guideUrl: O.some('https://equipment.makespace.org/wood-shop/band-saw'),
            riskAssessmentUrl: O.none,
            learnPoints: [],
            removedAt: O.none,
            area: {id: faker.string.uuid() as UUID, name: 'Wood Shop', email: O.none},
        },
        guideLink: O.some({
            url: 'https://equipment.makespace.org/wood-shop/band-saw',
            status: O.some(404),
            reachable,
            checkedAt: new Date('2026-09-28'),
        }),
        quizResults: O.none,
        tickets: {active: 0, resolvedRecently: 0},
        training: {activeTrainers: 0, trainingsRecently: 0},
    });

    // What it is and where it goes - the path says nothing to a reader, and a
    // long one pushes everything beside it off the line.
    it('says what the link is and where it goes, not the whole address', () => {
        const link = renderPage(withGuide(true)).querySelector(
            '.eq-facts a[href*="band-saw"]'
        );

        expect(
            link?.querySelector('.eq-capsule__label')?.textContent?.trim()
        ).toBe('Equipment guide');
        expect(
            link?.querySelector('.eq-capsule__where')?.textContent?.trim()
        ).toBe('equipment.makespace.org');
        expect(link?.textContent).not.toContain('/wood-shop/band-saw');
    });

    // Hidden from the page, but one hover away for anybody who wants to check
    // where they are about to go.
    it('keeps the whole address on the link and in its title', () => {
        const link = renderPage(withGuide(true)).querySelector(
            '.eq-facts a[href*="band-saw"]'
        );

        expect(link?.getAttribute('href')).toBe(
            'https://equipment.makespace.org/wood-shop/band-saw'
        );
        expect(link?.getAttribute('title')).toBe(
            'https://equipment.makespace.org/wood-shop/band-saw'
        );
    });

    it('marks the capsule when the link did not answer', () => {
        const page = renderPage(withGuide(false));

        expect(page.querySelector('.eq-capsule--dead')).not.toBeNull();
        // Beside the capsule, not a line of red underneath it.
        expect(
            page.querySelector('.eq-facts__fact .tooltip .guide-link-warning')
        ).not.toBeNull();
    });

    it('says nothing when the link answered', () => {
        const page = renderPage(withGuide(true));

        expect(page.querySelector('.eq-capsule--dead')).toBeNull();
        expect(page.querySelector('.guide-link-warning')).toBeNull();
    });
});

describe('the actions, in groups', () => {
    const renderPage = (vm: ViewModel) => {
        const body = document.createElement('body');
        body.innerHTML = render(vm).body;
        return body;
    };

    const equipmentId = faker.string.uuid() as UUID;
    const area = {
        id: faker.string.uuid() as UUID,
        name: 'Wood Shop',
        email: O.none,
    };

    const redEquipment: Equipment = {
        id: equipmentId,
        name: 'Band Saw',
        category: 'red',
        machineNames: [],
        trainers: [],
        trainedMembers: [],
        trainingSheetId: O.none,
        guideUrl: O.none,
        riskAssessmentUrl: O.none,
        learnPoints: [],
        removedAt: O.none,
        area,
    };

    const viewFor = (
        overrides: Partial<ViewModel> = {},
        equipment: Equipment = redEquipment
    ): ViewModel => ({
        user: {
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: faker.number.int({min: 1}),
        },
        isSuperUser: false,
        isSuperUserOrOwnerOfArea: false,
        isSuperUserOrTrainerOfArea: false,
        equipment,
        guideLink: O.none,
        tickets: {active: 0, resolvedRecently: 0},
        training: {activeTrainers: 0, trainingsRecently: 0},
        quizResults: O.none,
        ...overrides,
    });

    const headings = (viewModel: ViewModel) =>
        [...renderPage(viewModel).querySelectorAll('.equipment-actions h2')].map(
            node => (node.textContent ?? '').trim()
        );

    it('groups what an owner can do under headings in a fixed order', () => {
        expect(
            headings(
                viewFor({isSuperUser: true, isSuperUserOrOwnerOfArea: true, isSuperUserOrTrainerOfArea: true})
            )
        ).toStrictEqual(['Training', 'Update this equipment']);
    });

    // A heading with nothing under it is worse than no heading.
    it('leaves out a group with nothing in it for this person', () => {
        // An ordinary member may report a problem and see who is trained,
        // but has nothing to update.
        expect(headings(viewFor())).toStrictEqual(['Training']);
    });

    it('has no training group at all for equipment that needs none', () => {
        expect(
            headings(
                viewFor(
                    {isSuperUser: true, isSuperUserOrOwnerOfArea: true},
                    {...redEquipment, category: 'green'}
                )
            )
        ).toStrictEqual(['Update this equipment']);
    });

    it('puts each action under the heading it belongs to', () => {
        const rendered = renderPage(
            viewFor({isSuperUser: true, isSuperUserOrOwnerOfArea: true, isSuperUserOrTrainerOfArea: true})
        );
        const groups = [...rendered.querySelectorAll('.equipment-actions')].map(
            section => ({
                heading: (section.querySelector('h2')?.textContent ?? '').trim(),
                items: [...section.querySelectorAll('li')].map(item =>
                    (item.textContent ?? '').replace(/\s+/g, ' ').trim()
                ),
            })
        );
        const group = (heading: string) =>
            groups.find(candidate => candidate.heading === heading)?.items ?? [];


        // Some items carry a tooltip, so compare how each one opens.
        const opensWith = (items: ReadonlyArray<string>) =>
            items.map(item => item.split(' Only ')[0].trim());

        expect(opensWith(group('Training')).slice(0, 3)).toStrictEqual([
            'Mark member as trained',
            '[Admin] Mark member as trained by',
            'Add a trainer',
        ]);
        expect(group('Training').join(' ')).toContain(
            'View currently trained users'
        );
        const updates = group('Update this equipment').join(' | ');
        // Reporting a problem and reading the tickets are cards at the top of
        // the page now; printing a sign is a change to the record.
        expect(updates).toContain('Print a sign for this equipment');
        expect(updates).toContain('Change the sticker category');
        expect(updates).toContain('[Admin] Retire equipment');
        expect(updates).toContain('Name the machines this entry stands for');
        // Nothing about training or tickets strayed in here.
        expect(updates).not.toContain('Mark member as trained');
        expect(updates).not.toContain('Report a problem');
    });
});
