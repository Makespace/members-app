#!/usr/bin/env node
// Compares member-page training-matrix construction between the old
// implementation (full equipment expansion, from main) and the new one
// (minimal lookups), on the same synthetic fixture, in the same process.
//
// Usage:
//   npx tsx ./scripts/benchmark-training-matrix.ts
//
// Fixture sizes, query counts and timings are all printed, so the numbers in
// the PR description can be reproduced. Run from the repo root.
import createLogger from 'pino';
import * as libsqlClient from '@libsql/client';
import {initSharedReadModel, SharedReadModel} from '../src/read-models/shared-state';
import {constructEvent, Actor} from '../src/types';

// Same shape as tests/helpers' arbitraryActor; the benchmark imports nothing
// from tests/ so it can run standalone.
const arbitraryActor = (): Actor => ({tag: 'token', token: 'admin'});
import {UUID, NonEmptyString} from 'io-ts-types';
import {EquipmentId} from '../src/types/equipment-id';
import {EmailAddress} from '../src/types';
import {constructTrainingMatrix} from '../src/queries/training-matrix/construct-view-model';
import {Member} from '../src/read-models/shared-state/return-types';
import {FullQuizResultsForMember} from '../src/read-models/external-state/equipment-quiz';

const AREAS = 20;
const MACHINES_PER_AREA = 10;
const MEMBERS = 5000;
const TRAINING_RECORDS_PER_MEMBER = 2;
const MEASURED_RUNS = 10;

type StoredEvent = Parameters<SharedReadModel['updateState']>[0];

const applyEvent = (rm: SharedReadModel) => (event: ReturnType<ReturnType<typeof constructEvent>>) =>
  rm.updateState({
    ...event,
    event_id: crypto.randomUUID(),
    event_index: rm.getCurrentEventIndex() + 1,
    deletedAt: null,
    deleteReason: null,
    markDeletedByMemberNumber: null,
  } as unknown as StoredEvent);

// The old implementation, inlined so both run in the same process. This is
// verbatim from main at 95449119: it expanded every machine (trainers, trained
// members and their member details, area) via equipment.getAll(), then
// consumed only id, name and area.
const constructTrainingMatrixOld = (
  member: Member,
  sharedReadModel: SharedReadModel,
  quizData: FullQuizResultsForMember
) => {
  const equipmentList = sharedReadModel.equipment.getAll().toSorted(
    (a, b) => {
      if (a.area.id !== b.area.id) {
        return a.area.name.localeCompare(b.area.name, ['en-US']);
      }
      return a.name.localeCompare(b.name, ['en-US']);
    }
  );

  const equipmentEntries = equipmentList.flatMap(
    equipment => {
      const quizResults = quizData.equipmentQuiz[equipment.id];
      const isOwnerOfArea = member.ownerOf.find(o => o.id === equipment.area.id);
      const isTrainedOnEquipment = member.trainedOn.find(t => t.id === equipment.id);
      const isTrainerForEquipment = member.trainerFor.find(t => t.equipment_id === equipment.id);
      if (
        quizResults === undefined &&
        isOwnerOfArea === undefined &&
        isTrainedOnEquipment === undefined &&
        isTrainerForEquipment === undefined
      ) {
        return [];
      }
      return [{
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        area: {...equipment.area},
        is_trained: member.trainedOn.find(t => t.id === equipment.id)?.trainedAt,
        is_trainer: member.trainerFor.find(t => t.equipment_id === equipment.id)?.since,
      }];
    }
  );
  return equipmentEntries;
};

const timeMs = (action: () => unknown): number => {
  const started = process.hrtime.bigint();
  action();
  return Number(process.hrtime.bigint() - started) / 1_000_000;
};

const run = async () => {
  const logger = createLogger({level: 'silent'});
  const eventDB = libsqlClient.createClient({url: ':memory:'});
  const rm = initSharedReadModel(eventDB, logger);
  const apply = applyEvent(rm);

  console.log(`Fixture: ${AREAS} areas x ${MACHINES_PER_AREA} machines (${AREAS * MACHINES_PER_AREA} machines), ${MEMBERS} members x ${TRAINING_RECORDS_PER_MEMBER} training records (${MEMBERS * TRAINING_RECORDS_PER_MEMBER} trainedMembers rows)`);

  const areaIds: UUID[] = [];
  for (let a = 0; a < AREAS; a += 1) {
    const areaId = crypto.randomUUID() as UUID;
    areaIds.push(areaId);
    apply(constructEvent('AreaCreated')({id: areaId, name: `Area ${a}`, actor: arbitraryActor()}));
    for (let m = 0; m < MACHINES_PER_AREA; m += 1) {
      apply(constructEvent('EquipmentAdded')({
        id: crypto.randomUUID() as EquipmentId,
        name: `Machine ${a}-${m}` as NonEmptyString,
        areaId,
        category: 'red',
        actor: arbitraryActor(),
      }));
    }
  }

  const machineIdsForFixture = rm.equipment.getAllMinimal().map(e => e.id);
  for (let i = 0; i < MEMBERS; i += 1) {
    const memberNumber = 10000 + i;
    apply(constructEvent('MemberNumberLinkedToEmail')({
      memberNumber,
      email: `member${i}@example.com` as EmailAddress,
      name: `Member ${i}`,
      formOfAddress: undefined,
      actor: arbitraryActor(),
    }));
    for (let t = 0; t < TRAINING_RECORDS_PER_MEMBER; t += 1) {
      apply(constructEvent('MemberTrainedOnEquipmentBy')({
        equipmentId: machineIdsForFixture[(i * TRAINING_RECORDS_PER_MEMBER + t) % machineIdsForFixture.length] as EquipmentId,
        memberNumber,
        trainedByMemberNumber: memberNumber,
        trainedAt: new Date(),
        markedTrainedBy: memberNumber,
        actor: arbitraryActor(),
      }));
    }
  }

  const viewerNumber = 99999;
  apply(constructEvent('MemberNumberLinkedToEmail')({
    memberNumber: viewerNumber,
    email: 'viewer@example.com' as EmailAddress,
    name: 'Viewer',
    formOfAddress: undefined,
    actor: arbitraryActor(),
  }));
  const machineIdsAll = rm.equipment.getAllMinimal().map(e => e.id);
  for (const machineId of machineIdsAll.slice(0, AREAS)) {
    apply(constructEvent('MemberTrainedOnEquipmentBy')({
      equipmentId: machineId,
      memberNumber: viewerNumber,
      trainedByMemberNumber: viewerNumber,
      trainedAt: new Date(),
      markedTrainedBy: viewerNumber,
      actor: arbitraryActor(),
    }));
  }

  const member = rm.members.getByMemberNumber(viewerNumber);
  if (member._tag !== 'Some') {
    throw new Error('viewer not found');
  }
  const quizData: FullQuizResultsForMember = {equipmentQuiz: {}};
  const viewer = member.value;

  const measure = (name: string, fn: () => unknown) => {
    for (let i = 0; i < 3; i += 1) {
      fn();
    }
    const timings: number[] = [];
    let queryCount = 0;
    for (let i = 0; i < MEASURED_RUNS; i += 1) {
      const {ms, qc} = measureOnce(rm, fn);
      timings.push(ms);
      queryCount = qc;
    }
    timings.sort((a, b) => a - b);
    const median = timings[Math.floor(timings.length / 2)];
    console.log(
      `${name}: median ${median.toFixed(2)} ms (min ${timings[0].toFixed(2)}, max ${timings[timings.length - 1].toFixed(2)}) over ${MEASURED_RUNS} runs, ${queryCount} SQL queries per construction`
    );
  };

  measure('old (full expansion) ', () => constructTrainingMatrixOld(viewer, rm, quizData));
  measure('new (minimal lookups)', () => constructTrainingMatrix(viewer, rm, quizData));
};

const measureOnce = (
  rm: SharedReadModel,
  fn: () => unknown
): {ms: number; qc: number} => {
  let qc = 0;
  const db = rm._underlyingReadModelDb;
  const originalPrepare = db.prepare.bind(db);
  db.prepare = ((...args: Parameters<typeof originalPrepare>) => {
    qc += 1;
    return originalPrepare(...args);
  }) as typeof db.prepare;
  try {
    return {ms: timeMs(fn), qc};
  } finally {
    db.prepare = originalPrepare;
  }
};

run().catch(e => {
  console.error(e);
  process.exit(1);
});
