import { faker } from "@faker-js/faker";
import { Actor, constructEvent } from "../../../src/types";
import { arbitraryActor } from "../../helpers";
import { initTestFramework, TestFramework } from "../../read-models/test-framework";
import { UUID } from "io-ts-types";
import { arbitraryUser } from "../../types/user.helper";
import { isEquipmentTrainer } from "../../../src/commands/authentication-helpers/is-equipment-trainer";
import { isAdminSuperUserOrOwnerForEquipment } from "../../../src/commands/authentication-helpers/is-admin-or-super-user-or-owner";
import { isAdminSuperUserOrTrainerForEquipment } from "../../../src/commands/authentication-helpers/is-admin-or-super-user-or-trainer";
import { isAdminSuperUserOrTrainerOrOwnerForEquipment } from "../../../src/commands/authentication-helpers/is-admin-or-super-user-or-owner-trainer";
import { isAdminOrSuperUser } from "../../../src/commands/authentication-helpers/is-admin-or-super-user";
import { isEquipmentOwner } from "../../../src/commands/authentication-helpers/is-equipment-owner";
import { isSelfOrPrivileged } from "../../../src/commands/authentication-helpers/is-self-or-privileged";
import { isSelf } from "../../../src/commands/authentication-helpers/is-self";


describe('authentication helpers', () => {
    const area1 = {
        name: 'area',
        id: faker.string.uuid() as UUID,
    };
    const equipment1 = {
        name: 'equipment1',
        id: faker.string.uuid() as UUID,
        areaId: area1.id,
    };
    const area1Owner = arbitraryUser();
    const equipment1Trainer = arbitraryUser();

    const area2 = {
        name: 'area',
        id: faker.string.uuid() as UUID,
    };
    const equipment2 = {
        name: 'equipment2',
        id: faker.string.uuid() as UUID,
        areaId: area2.id,
    };
    const area2Owner = arbitraryUser();

    const userToBeSuperUser = arbitraryUser();
    const randomUser = arbitraryUser();

    const baseEvents = [
        ...[
            area1Owner, equipment1Trainer, area2Owner, userToBeSuperUser, randomUser
        ].map(user => constructEvent('MemberNumberLinkedToEmail')({
            memberNumber: user.memberNumber,
            email: user.emailAddress,
            name: undefined,
            formOfAddress: undefined,
            actor: arbitraryActor()
        })),

        constructEvent('AreaCreated')({...area1, actor: arbitraryActor()}),
        constructEvent('EquipmentAdded')({...equipment1, actor: arbitraryActor()}),
        constructEvent('OwnerAdded')({
            memberNumber: area1Owner.memberNumber,
            actor: arbitraryActor(),
            areaId: area1.id,
        }),
        constructEvent('OwnerAdded')({
            memberNumber: equipment1Trainer.memberNumber,
            actor: arbitraryActor(),
            areaId: area1.id,
        }),
        constructEvent('TrainerAdded')({
          memberNumber: equipment1Trainer.memberNumber,
          equipmentId: equipment1.id,
          actor: arbitraryActor(),
        }),

        constructEvent('AreaCreated')({...area2, actor: arbitraryActor()}),
        constructEvent('EquipmentAdded')({...equipment2, actor: arbitraryActor()}),
        constructEvent('OwnerAdded')({
            memberNumber: area2Owner.memberNumber,
            actor: arbitraryActor(),
            areaId: area2.id,
        }),

        constructEvent('SuperUserDeclared')({
            memberNumber: userToBeSuperUser.memberNumber,
            actor: arbitraryActor(),
        }),
    ];
    let framework: TestFramework;
    beforeEach(async () => {
        framework = await initTestFramework();
        baseEvents.forEach(framework.sharedReadModel.updateState);
    });
    afterEach(() => {
        framework.close();
    });

    const authenticateHelperTest = (
        memberNumber: number,
        actors: {
            actorName: string,
            actor: Actor,
            isAdminSuperUserOrTrainerOrOwnerForEquipment1: boolean,
            isAdminSuperUserOrTrainerForEquipment1: boolean,
            isAdminSuperUserOrOwnerForEquipment1: boolean,
            isAdminOrSuperUser: boolean,
            isEquipment1Owner: boolean,
            isEquipment1Trainer: boolean,
            isSelfOrPrivileged: boolean,
            isSelf: boolean,
        }[]
    ) => actors.forEach(
        actorTestCase => describe(actorTestCase.actorName, () => {
            it('isAdminSuperUserOrTrainerOrOwnerForEquipment', () => {
                expect(isAdminSuperUserOrTrainerOrOwnerForEquipment({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input: {
                        equipmentId: equipment1.id
                    }
                })).toBe(actorTestCase.isAdminSuperUserOrTrainerOrOwnerForEquipment1);
            });
            it('isAdminSuperUserOrTrainerForEquipment', () => {
                expect(isAdminSuperUserOrTrainerForEquipment({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input: {
                        equipmentId: equipment1.id
                    }
                })).toBe(actorTestCase.isAdminSuperUserOrTrainerForEquipment1);
            });
            it('isAdminSuperUserOrOwnerForEquipment', () => {
                expect(isAdminSuperUserOrOwnerForEquipment({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input: {
                        equipmentId: equipment1.id
                    }
                })).toBe(actorTestCase.isAdminSuperUserOrOwnerForEquipment1);
            });
            it('isAdminOrSuperUser', () => {
                expect(isAdminOrSuperUser({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                })).toBe(actorTestCase.isAdminOrSuperUser);
            });
            it('isEquipmentOwner', () => {
                expect(isEquipmentOwner({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input: {
                        equipmentId: equipment1.id
                    }
                })).toBe(actorTestCase.isEquipment1Owner);
            });
            it('isEquipmentTrainer', () => {
                expect(isEquipmentTrainer({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input: {
                        equipmentId: equipment1.id
                    }
                })).toBe(actorTestCase.isEquipment1Trainer);
            });
            it('isSelfOrPrivileged', () => {
                expect(isSelfOrPrivileged({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input: {
                        memberNumber
                    }
                })).toBe(actorTestCase.isSelfOrPrivileged);
            });
            it('isSelf', () => {
                expect(isSelf({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input: {
                        memberNumber
                    },
                })).toBe(actorTestCase.isSelf);
            });
        })
    );

    authenticateHelperTest(
        equipment1Trainer.memberNumber,
        [
            {
                actorName: "admin via token",
                actor: {tag: 'token', token: 'admin'} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment1: true,
                isAdminSuperUserOrTrainerForEquipment1: true,
                isAdminSuperUserOrOwnerForEquipment1: true,
                isAdminOrSuperUser: true,
                isEquipment1Owner: false,
                isEquipment1Trainer: false,
                isSelfOrPrivileged: true,
                isSelf: false
            },
            {
                actorName: "super user",
                actor: {tag: 'user', user: userToBeSuperUser} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment1: true,
                isAdminSuperUserOrTrainerForEquipment1: true,
                isAdminSuperUserOrOwnerForEquipment1: true,
                isAdminOrSuperUser: true,
                isEquipment1Owner: false,
                isEquipment1Trainer: false,
                isSelfOrPrivileged: true,
                isSelf: false
            },
            {
                actorName: "random user",
                actor: {tag: 'user', user: randomUser} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment1: false,
                isAdminSuperUserOrTrainerForEquipment1: false,
                isAdminSuperUserOrOwnerForEquipment1: false,
                isAdminOrSuperUser: false,
                isEquipment1Owner: false,
                isEquipment1Trainer: false,
                isSelfOrPrivileged: false,
                isSelf: false
            },
            {
                actorName: "area 1 owner",
                actor: {tag: 'user', user: area1Owner} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment1: true,
                isAdminSuperUserOrTrainerForEquipment1: false,
                isAdminSuperUserOrOwnerForEquipment1: true,
                isAdminOrSuperUser: false,
                isEquipment1Owner: true,
                isEquipment1Trainer: false,
                isSelfOrPrivileged: false,
                isSelf: false
            },
            {
                actorName: "equipment 1 trainer",
                actor: {tag: 'user', user: equipment1Trainer} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment1: true,
                isAdminSuperUserOrTrainerForEquipment1: true,
                isAdminSuperUserOrOwnerForEquipment1: true,
                isAdminOrSuperUser: false,
                isEquipment1Owner: true,
                isEquipment1Trainer: true,
                isSelfOrPrivileged: true,
                isSelf: true
            }
        ]
    );

    describe('revoked super user', () => {
        beforeEach(() => {
            framework.sharedReadModel.updateState(
                constructEvent('SuperUserRevoked')({
                    memberNumber: userToBeSuperUser.memberNumber,
                    actor: arbitraryActor(),
                })
            );
        });

        authenticateHelperTest(
            equipment1Trainer.memberNumber,
            [
                {
                    actorName: "revoked super user",
                    actor: {tag: 'user', user: userToBeSuperUser} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment1: false,
                    isAdminSuperUserOrTrainerForEquipment1: false,
                    isAdminSuperUserOrOwnerForEquipment1: false,
                    isAdminOrSuperUser: false,
                    isEquipment1Owner: false,
                    isEquipment1Trainer: false,
                    isSelfOrPrivileged: false,
                    isSelf: false
                },
            ]
        );

        describe('reinstated super user', () => {
            beforeEach(() => {
                framework.sharedReadModel.updateState(
                    constructEvent('SuperUserDeclared')({
                        memberNumber: userToBeSuperUser.memberNumber,
                        actor: arbitraryActor(),
                    })
                );
            });

            authenticateHelperTest(
                equipment1Trainer.memberNumber,
                [
                    {
                        actorName: "reinstated super user",
                        actor: {tag: 'user', user: userToBeSuperUser} satisfies Actor,
                        isAdminSuperUserOrTrainerOrOwnerForEquipment1: true,
                        isAdminSuperUserOrTrainerForEquipment1: true,
                        isAdminSuperUserOrOwnerForEquipment1: true,
                        isAdminOrSuperUser: true,
                        isEquipment1Owner: false,
                        isEquipment1Trainer: false,
                        isSelfOrPrivileged: true,
                        isSelf: false
                    },
                ]
            );
        });
    });
});