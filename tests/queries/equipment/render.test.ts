
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
import { FullQuizResults } from '../../../src/read-models/external-state/equipment-quiz';
import { UUID } from 'io-ts-types';

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
        emailAddress: faker.internet.email() as EmailAddress,
        pastMemberNumbers: [],
        markedTrainerByActor: O.some({
            tag: 'user',
            user: {
                emailAddress: faker.internet.email() as EmailAddress,
                memberNumber: faker.number.int({min: 1}),
            }
        }),
        trainerSince: faker.date.past(),
    };
    const trainedMember: Readonly<TrainedMember> = {
        name: O.some(faker.animal.dog()),
        memberNumber: faker.number.int({min: 1}),
        emailAddress: faker.internet.email() as EmailAddress,
        pastMemberNumbers: [],
        markedTrainedByActor: O.some({
            tag: 'user',
            user: {
                memberNumber: trainer.memberNumber,
                emailAddress: trainer.emailAddress,
            }
        }),
        trainedByMemberNumber: O.some(trainer.memberNumber),
        trainedByEmail: O.some(trainer.emailAddress),
        trainedSince: faker.date.between({from: trainer.trainerSince, to: new Date()}),
        legacyImport: false,
    };

    const equipment: Readonly<Equipment> = {
        id: faker.string.uuid() as UUID,
        name: faker.airline.aircraftType(),
        trainers: [
            trainer
        ],
        trainedMembers: [
            trainedMember
        ],
        trainingSheetId: O.some(faker.string.alpha({length: 20})),
        area: {
            id: faker.string.uuid() as UUID,
            name: faker.airline.airline().name,
            email: O.some(faker.internet.email() as EmailAddress),
        }
    };
    const quizResults: Readonly<FullQuizResults> = {
        lastQuizSync: O.none,
        membersAwaitingTraining: [],
        unknownMembersAwaitingTraining: [],
        failedQuizes: []
    };
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
            quizResults: O.some(quizResults)
        };
        let renderedDom: HTMLElement;

        beforeEach(() => {
            renderedDom = renderPage(viewmodel);
        });

        it('cannot see revoke training button', () => {
            expect(findRevokeTrainingButton(renderedDom)).toStrictEqual(O.none);
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
            quizResults: O.some(quizResults)
        };
        let renderedDom: HTMLElement;

        beforeEach(() => {
            renderedDom = renderPage(viewmodel);
        });

        describe('get revoke training button', () => {
            let button: O.Option<HTMLElement>;
            beforeEach(() => {
                button = findRevokeTrainingButton(renderedDom);
            });

            it('revoke training button is rendered', () => {
                expect(O.isSome(button)).toBeTruthy();
            });
        });

        
    });



});
