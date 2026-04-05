import { faker } from "@faker-js/faker";
import { Actor, constructEvent } from "../../../src/types";
import { arbitraryActor, systemActor } from "../../helpers";
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
import { EquipmentId } from "../../../src/types/equipment-id";


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
    const unlinkedUser = arbitraryUser();
    const missingEquipmentId = faker.string.uuid() as UUID;

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
        baseEvents.forEach(framework.insertIntoSharedReadModel);
    });
    afterEach(() => {
        framework.close();
    });

    const authenticateHelperTest = (
        input: {
            memberNumber: number,
            equipmentId: EquipmentId,
        },
        actors: {
            actorName: string,
            actor: Actor,
            isAdminSuperUserOrTrainerOrOwnerForEquipment: boolean,
            isAdminSuperUserOrTrainerForEquipment: boolean,
            isAdminSuperUserOrOwnerForEquipment: boolean,
            isAdminOrSuperUser: boolean,
            isEquipmentOwner: boolean,
            isEquipmentTrainer: boolean,
            isSelfOrPrivileged: boolean,
            isSelf: boolean,
        }[]
    ) => actors.forEach(
        actorTestCase => describe(actorTestCase.actorName, () => {
            it('isAdminSuperUserOrTrainerOrOwnerForEquipment', () => {
                expect(isAdminSuperUserOrTrainerOrOwnerForEquipment({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input
                })).toBe(actorTestCase.isAdminSuperUserOrTrainerOrOwnerForEquipment);
            });
            it('isAdminSuperUserOrTrainerForEquipment', () => {
                expect(isAdminSuperUserOrTrainerForEquipment({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input
                })).toBe(actorTestCase.isAdminSuperUserOrTrainerForEquipment);
            });
            it('isAdminSuperUserOrOwnerForEquipment', () => {
                expect(isAdminSuperUserOrOwnerForEquipment({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input
                })).toBe(actorTestCase.isAdminSuperUserOrOwnerForEquipment);
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
                    input
                })).toBe(actorTestCase.isEquipmentOwner);
            });
            it('isEquipmentTrainer', () => {
                expect(isEquipmentTrainer({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input
                })).toBe(actorTestCase.isEquipmentTrainer);
            });
            it('isSelfOrPrivileged', () => {
                expect(isSelfOrPrivileged({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input
                })).toBe(actorTestCase.isSelfOrPrivileged);
            });
            it('isSelf', () => {
                expect(isSelf({
                    actor: actorTestCase.actor,
                    rm: framework.sharedReadModel,
                    input
                })).toBe(actorTestCase.isSelf);
            });
        })
    );

    authenticateHelperTest(
        {
            equipmentId: equipment1.id,
            memberNumber: equipment1Trainer.memberNumber,
        },
        [
            {
                actorName: "admin via token",
                actor: {tag: 'token', token: 'admin'} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment: true,
                isAdminSuperUserOrTrainerForEquipment: true,
                isAdminSuperUserOrOwnerForEquipment: true,
                isAdminOrSuperUser: true,
                isEquipmentOwner: false,
                isEquipmentTrainer: false,
                isSelfOrPrivileged: true,
                isSelf: false
            },
            {
                actorName: "system",
                actor: systemActor(),
                isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                isAdminSuperUserOrTrainerForEquipment: false,
                isAdminSuperUserOrOwnerForEquipment: false,
                isAdminOrSuperUser: false,
                isEquipmentOwner: false,
                isEquipmentTrainer: false,
                isSelfOrPrivileged: false,
                isSelf: false
            },
            {
                actorName: "super user",
                actor: {tag: 'user', user: userToBeSuperUser} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment: true,
                isAdminSuperUserOrTrainerForEquipment: true,
                isAdminSuperUserOrOwnerForEquipment: true,
                isAdminOrSuperUser: true,
                isEquipmentOwner: false,
                isEquipmentTrainer: false,
                isSelfOrPrivileged: true,
                isSelf: false
            },
            {
                actorName: "random user",
                actor: {tag: 'user', user: randomUser} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                isAdminSuperUserOrTrainerForEquipment: false,
                isAdminSuperUserOrOwnerForEquipment: false,
                isAdminOrSuperUser: false,
                isEquipmentOwner: false,
                isEquipmentTrainer: false,
                isSelfOrPrivileged: false,
                isSelf: false
            },
            {
                actorName: "area 1 owner",
                actor: {tag: 'user', user: area1Owner} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment: true,
                isAdminSuperUserOrTrainerForEquipment: false,
                isAdminSuperUserOrOwnerForEquipment: true,
                isAdminOrSuperUser: false,
                isEquipmentOwner: true,
                isEquipmentTrainer: false,
                isSelfOrPrivileged: false,
                isSelf: false
            },
            {
                actorName: "area 2 owner",
                actor: {tag: 'user', user: area2Owner} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                isAdminSuperUserOrTrainerForEquipment: false,
                isAdminSuperUserOrOwnerForEquipment: false,
                isAdminOrSuperUser: false,
                isEquipmentOwner: false,
                isEquipmentTrainer: false,
                isSelfOrPrivileged: false,
                isSelf: false
            },
            {
                actorName: "equipment 1 trainer",
                actor: {tag: 'user', user: equipment1Trainer} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment: true,
                isAdminSuperUserOrTrainerForEquipment: true,
                isAdminSuperUserOrOwnerForEquipment: true,
                isAdminOrSuperUser: false,
                isEquipmentOwner: true,
                isEquipmentTrainer: true,
                isSelfOrPrivileged: true,
                isSelf: true
            }
        ]
    );

    authenticateHelperTest(
        // Unregistered users should never return true when authing.
        // Even if self.
        {
            equipmentId: equipment1.id,
            memberNumber: unlinkedUser.memberNumber
        },
        [
            {
                actorName: "unlinked user as self",
                actor: {tag: 'user', user: unlinkedUser} satisfies Actor,
                isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                isAdminSuperUserOrTrainerForEquipment: false,
                isAdminSuperUserOrOwnerForEquipment: false,
                isAdminOrSuperUser: false,
                isEquipmentOwner: false,
                isEquipmentTrainer: false,
                isSelfOrPrivileged: false,
                isSelf: false
            }
        ]
    );

    describe('missing equipment', () => {
        authenticateHelperTest(
            {
                memberNumber: equipment1Trainer.memberNumber,
                equipmentId: missingEquipmentId,
            },
            [
                {
                    actorName: "admin via token",
                    actor: {tag: 'token', token: 'admin'} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: true,
                    isAdminSuperUserOrTrainerForEquipment: true,
                    isAdminSuperUserOrOwnerForEquipment: true,
                    isAdminOrSuperUser: true,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: true,
                    isSelf: false
                },
                {
                    actorName: "system",
                    actor: systemActor(),
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                    isAdminSuperUserOrTrainerForEquipment: false,
                    isAdminSuperUserOrOwnerForEquipment: false,
                    isAdminOrSuperUser: false,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: false,
                    isSelf: false
                },
                {
                    actorName: "super user",
                    actor: {tag: 'user', user: userToBeSuperUser} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: true,
                    isAdminSuperUserOrTrainerForEquipment: true,
                    isAdminSuperUserOrOwnerForEquipment: true,
                    isAdminOrSuperUser: true,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: true,
                    isSelf: false
                },
                {
                    actorName: "area 1 owner",
                    actor: {tag: 'user', user: area1Owner} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                    isAdminSuperUserOrTrainerForEquipment: false,
                    isAdminSuperUserOrOwnerForEquipment: false,
                    isAdminOrSuperUser: false,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: false,
                    isSelf: false
                },
                {
                    actorName: "equipment 1 trainer",
                    actor: {tag: 'user', user: equipment1Trainer} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                    isAdminSuperUserOrTrainerForEquipment: false,
                    isAdminSuperUserOrOwnerForEquipment: false,
                    isAdminOrSuperUser: false,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: true,
                    isSelf: true
                }
            ]
        );
    });

    describe('area 1 owner removed', () => {
        beforeEach(() => {
            framework.insertIntoSharedReadModel(
                constructEvent('OwnerRemoved')({
                    memberNumber: area1Owner.memberNumber,
                    actor: arbitraryActor(),
                    areaId: area1.id,
                })
            );
        });

        authenticateHelperTest(
            {
                equipmentId: equipment1.id,
                memberNumber: equipment1Trainer.memberNumber,
            },
            [
                {
                    actorName: "area 1 owner",
                    actor: {tag: 'user', user: area1Owner} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                    isAdminSuperUserOrTrainerForEquipment: false,
                    isAdminSuperUserOrOwnerForEquipment: false,
                    isAdminOrSuperUser: false,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: false,
                    isSelf: false
                },
            ]
        );
    });

    describe('equipment 1 trainer owner removed', () => {
        beforeEach(() => {
            framework.insertIntoSharedReadModel(
                constructEvent('OwnerRemoved')({
                    memberNumber: equipment1Trainer.memberNumber,
                    actor: arbitraryActor(),
                    areaId: area1.id,
                })
            );
        });

        authenticateHelperTest(
            {
                equipmentId: equipment1.id,
                memberNumber: equipment1Trainer.memberNumber,
            },
            [
                {
                    actorName: "equipment 1 trainer",
                    actor: {tag: 'user', user: equipment1Trainer} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                    isAdminSuperUserOrTrainerForEquipment: false,
                    isAdminSuperUserOrOwnerForEquipment: false,
                    isAdminOrSuperUser: false,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false, // You must be an owner to be a trainer
                    isSelfOrPrivileged: true,
                    isSelf: true
                },
            ]
        );
    });

    describe('area removed', () => {
        beforeEach(() => {
            framework.insertIntoSharedReadModel(
                constructEvent('AreaRemoved')({
                    id: area1.id,
                    actor: arbitraryActor(),
                })
            );
        });

        authenticateHelperTest(
            {
                equipmentId: equipment1.id,
                memberNumber: equipment1Trainer.memberNumber,
            },
            [
                {
                    actorName: "area 1 owner",
                    actor: {tag: 'user', user: area1Owner} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                    isAdminSuperUserOrTrainerForEquipment: false,
                    isAdminSuperUserOrOwnerForEquipment: false,
                    isAdminOrSuperUser: false,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: false,
                    isSelf: false
                },
                {
                    actorName: "equipment 1 trainer",
                    actor: {tag: 'user', user: equipment1Trainer} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                    isAdminSuperUserOrTrainerForEquipment: false,
                    isAdminSuperUserOrOwnerForEquipment: false,
                    isAdminOrSuperUser: false,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: true,
                    isSelf: true
                },
            ]
        );
    });

    describe('revoked super user', () => {
        beforeEach(() => {
            framework.insertIntoSharedReadModel(
                constructEvent('SuperUserRevoked')({
                    memberNumber: userToBeSuperUser.memberNumber,
                    actor: arbitraryActor(),
                })
            );
        });

        authenticateHelperTest(
            {
                equipmentId: equipment1.id,
                memberNumber: equipment1Trainer.memberNumber,
            },
            [
                {
                    actorName: "revoked super user",
                    actor: {tag: 'user', user: userToBeSuperUser} satisfies Actor,
                    isAdminSuperUserOrTrainerOrOwnerForEquipment: false,
                    isAdminSuperUserOrTrainerForEquipment: false,
                    isAdminSuperUserOrOwnerForEquipment: false,
                    isAdminOrSuperUser: false,
                    isEquipmentOwner: false,
                    isEquipmentTrainer: false,
                    isSelfOrPrivileged: false,
                    isSelf: false
                },
            ]
        );

        describe('reinstated super user', () => {
            beforeEach(() => {
                framework.insertIntoSharedReadModel(
                    constructEvent('SuperUserDeclared')({
                        memberNumber: userToBeSuperUser.memberNumber,
                        actor: arbitraryActor(),
                    })
                );
            });

            authenticateHelperTest(
                {
                    equipmentId: equipment1.id,
                    memberNumber: equipment1Trainer.memberNumber,
                },
                [
                    {
                        actorName: "reinstated super user",
                        actor: {tag: 'user', user: userToBeSuperUser} satisfies Actor,
                        isAdminSuperUserOrTrainerOrOwnerForEquipment: true,
                        isAdminSuperUserOrTrainerForEquipment: true,
                        isAdminSuperUserOrOwnerForEquipment: true,
                        isAdminOrSuperUser: true,
                        isEquipmentOwner: false,
                        isEquipmentTrainer: false,
                        isSelfOrPrivileged: true,
                        isSelf: false
                    },
                ]
            );
        });
    });
});
