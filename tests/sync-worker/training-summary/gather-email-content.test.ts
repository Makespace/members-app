import {faker} from '@faker-js/faker';
import {
  EmailContent,
  gatherEmailContent,
} from '../../../src/sync-worker/training-summary/gather-email-content';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {UUID} from 'io-ts-types/lib/UUID';
import {EmailAddress} from '../../../src/types/email-address';
import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {insertRecurlySubscription} from '../../helpers';
import {UserActor} from '../../../src/types/actor';

describe('Training summary', () => {
  let framework: TestFramework;
  let content: EmailContent;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });
  describe('Gather email content', () => {
    describe('The database is empty', () => {
      beforeEach(async () => {
        content = await gatherEmailContent(framework.trainingSummaryDeps);
      });
      it('members joined within 30 days to be 0', () => {
        expect(content.membersJoinedWithin30Days).toStrictEqual(0);
      });
      it('total active members to be 0', () => {
        expect(content.totalActiveMembers).toStrictEqual(0);
      });
      it('there is no equipment', () => {
        expect(content.trainingStatsPerEquipment).toHaveLength(0);
      });
    });
    describe('Add 1 piece of equipment', () => {
      const equipmentId = faker.string.uuid() as UUID;
      const addTrainerMember = {
        memberNumber: faker.number.int(),
        email: faker.internet.email() as EmailAddress,
        name: 'Bean',
        formOfAddress: 'he/him',
      };
      const addTrainedMember = {
        memberNumber: faker.number.int() as Int,
        email: faker.internet.email() as EmailAddress,
        name: 'Bob',
        formOfAddress: 'he/him',
      };
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.airline.airport().name as NonEmptyString,
      };
      const addEquipment = {
        id: equipmentId,
        name: faker.science.chemicalElement().name as NonEmptyString,
        areaId: createArea.id,
      };
      const addOwner = {
        memberNumber: addTrainerMember.memberNumber,
        areaId: createArea.id,
      };
      const addTrainer = {
        memberNumber: addTrainerMember.memberNumber,
        equipmentId: equipmentId,
      };
      const markTrained = {
        equipmentId: equipmentId,
        memberNumber: addTrainedMember.memberNumber,
      };
      // const addTrainingSheet = {
      //   equipmentId,
      //   trainingSheetId: 'testTrainingSheetId',
      // };

      beforeEach(async () => {
        await framework.commands.memberNumbers.linkNumberToEmail(
          addTrainerMember
        );
        await framework.commands.memberNumbers.linkNumberToEmail(
          addTrainedMember
        );
        await insertRecurlySubscription(framework.extDB, {
          email: addTrainerMember.email,
          hasActiveSubscription: true,
        });
        await insertRecurlySubscription(framework.extDB, {
          email: addTrainedMember.email,
          hasActiveSubscription: true,
        });
        await framework.commands.area.create(createArea);
        await framework.commands.equipment.add(addEquipment);
        await framework.commands.area.addOwner(addOwner);
        await framework.commands.trainers.add(addTrainer);
        await framework.commands.trainers.markTrained(markTrained);

        content = await gatherEmailContent(framework.trainingSummaryDeps);
      });

      it('members joined within 30 days to be 2', () => {
        expect(content.membersJoinedWithin30Days).toStrictEqual(2);
      });
      it('total active members to be 2', () => {
        expect(content.totalActiveMembers).toStrictEqual(2);
      });
      it('calculates equipment training coverage from active member count', () => {
        expect(
          content.trainingStatsPerEquipment[0].percentageOfActiveMembershipTrained
        ).toStrictEqual(50);
      });
      it('the equipment shows no members awaiting training because there is no training sheet', () => {
        expect(content.trainingStatsPerEquipment[0].awaitingTraining).toBe(
          O.none
        );
      });

      it('there to be 1 piece of equipment', () => {
        expect(content.trainingStatsPerEquipment).toHaveLength(1);
      });

      describe('and an orange and a green piece of equipment', () => {
        beforeEach(async () => {
          await framework.commands.equipment.add({
            id: faker.string.uuid() as UUID,
            name: 'Orange thing' as NonEmptyString,
            areaId: createArea.id,
            category: 'orange',
          });
          await framework.commands.equipment.add({
            id: faker.string.uuid() as UUID,
            name: 'Green thing' as NonEmptyString,
            areaId: createArea.id,
            category: 'green',
          });
          content = await gatherEmailContent(framework.trainingSummaryDeps);
        });

        it('only the red equipment is included', () => {
          expect(content.trainingStatsPerEquipment).toHaveLength(1);
          expect(content.trainingStatsPerEquipment[0].name).toStrictEqual(
            addEquipment.name
          );
        });
      });

      it('the equipment link to be correct', () => {
        expect(
          content.trainingStatsPerEquipment[0].equipmentLink.href
        ).toStrictEqual(
          `${framework.trainingSummaryDeps.conf.PUBLIC_URL}/equipment/${equipmentId}`
        );
      });

      it('the equipment has no open trouble tickets', () => {
        expect(
          content.trainingStatsPerEquipment[0].openTroubleTickets
        ).toStrictEqual(0);
      });
      it('the total open trouble tickets to be 0', () => {
        expect(content.totalOpenTroubleTickets).toStrictEqual(0);
      });

      describe('and the equipment has trouble tickets', () => {
        const ownerActor: UserActor = {
          tag: 'user',
          user: {
            emailAddress: addTrainerMember.email,
            memberNumber: addTrainerMember.memberNumber,
          },
        };

        // Each ticket needs a distinct issue: create derives its rowHash from
        // submittedAt plus the answers, so same-millisecond tickets with
        // identical answers collide and silently no-op.
        const createTicket = async (issue: string): Promise<UUID> => {
          const ticketId = faker.string.uuid() as UUID;
          await framework.commands.troubleTickets.create({
            id: ticketId,
            submittedEquipment: addEquipment.name,
            submittedMemberNumber: null,
            submittedEmail: null,
            submittedName: null,
            otherEquipmentDetail: '',
            status: 'Broken',
            attempting: 'using the equipment',
            issue,
            steps: '',
          });
          return ticketId;
        };

        describe('with a ticket in each status and one resolved', () => {
          beforeEach(async () => {
            await createTicket('a todo ticket');
            const inProgressTicketId = await createTicket(
              'an in progress ticket'
            );
            await framework.commands.troubleTickets.assign({
              ticketId: inProgressTicketId,
              comment: '',
              actor: ownerActor,
            });
            const parkedTicketId = await createTicket('a parked ticket');
            await framework.commands.troubleTickets.park({
              ticketId: parkedTicketId,
              whyParked: 'Waiting on parts' as NonEmptyString,
              pathToResolution: 'Replace the bracket' as NonEmptyString,
              intermediateActions: 'Taped over the sharp edge' as NonEmptyString,
            });
            const needsHelpTicketId = await createTicket('a needs help ticket');
            await framework.commands.troubleTickets.needsHelp({
              ticketId: needsHelpTicketId,
              whatTried: 'Tightened the chuck' as NonEmptyString,
              whyDidntWork: 'Still grinding' as NonEmptyString,
            });
            const resolvedTicketId = await createTicket('a resolved ticket');
            await framework.commands.troubleTickets.resolve({
              ticketId: resolvedTicketId,
              summary: 'Replaced the part',
              quiet: true,
            });

            content = await gatherEmailContent(framework.trainingSummaryDeps);
          });

          it('the status transitions took effect', () => {
            // The read model logs (rather than raises) projection failures, so
            // a swallowed error would otherwise leave the counts passing for
            // the wrong reason.
            const ticketStatuses = new Map(
              framework.sharedReadModel.troubleTickets
                .getAll()
                .map(ticket => [ticket.response.issue, ticket.status])
            );
            expect(ticketStatuses.get('a todo ticket')).toStrictEqual('Todo');
            expect(ticketStatuses.get('an in progress ticket')).toStrictEqual(
              'In Progress'
            );
            expect(ticketStatuses.get('a parked ticket')).toStrictEqual(
              'Parked'
            );
            expect(ticketStatuses.get('a needs help ticket')).toStrictEqual(
              'Needs Help'
            );
            expect(ticketStatuses.get('a resolved ticket')).toStrictEqual(
              'Resolved'
            );
          });

          it('every open status is counted and the resolved ticket is excluded', () => {
            expect(
              content.trainingStatsPerEquipment[0].openTroubleTickets
            ).toStrictEqual(4);
          });

          it('the total open trouble tickets excludes the resolved ticket', () => {
            expect(content.totalOpenTroubleTickets).toStrictEqual(4);
          });
        });

        describe('and another piece of red equipment has an open ticket', () => {
          beforeEach(async () => {
            await framework.commands.equipment.add({
              id: faker.string.uuid() as UUID,
              name: 'Other red thing' as NonEmptyString,
              areaId: createArea.id,
            });
            await framework.commands.troubleTickets.create({
              id: faker.string.uuid() as UUID,
              submittedEquipment: 'Other red thing',
              submittedMemberNumber: null,
              submittedEmail: null,
              submittedName: null,
              otherEquipmentDetail: '',
              status: 'Broken',
              attempting: 'using the equipment',
              issue: 'a ticket on other equipment',
              steps: '',
            });
            content = await gatherEmailContent(framework.trainingSummaryDeps);
          });

          it('the ticket is counted against its own equipment only', () => {
            const thisEquipment = content.trainingStatsPerEquipment.find(
              stats => stats.name === (addEquipment.name as string)
            );
            const otherEquipment = content.trainingStatsPerEquipment.find(
              stats => stats.name === 'Other red thing'
            );
            expect(thisEquipment?.openTroubleTickets).toStrictEqual(0);
            expect(otherEquipment?.openTroubleTickets).toStrictEqual(1);
            expect(content.totalOpenTroubleTickets).toStrictEqual(1);
          });
        });
      });
    });
  });
});
