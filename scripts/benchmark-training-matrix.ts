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
import {deepStrictEqual} from 'node:assert';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
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
import {TrainingMatrix} from '../src/queries/training-matrix/render';

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

// The complete previous implementation from 95449119, with only the function
// name changed. Keep this baseline fixed so both versions do equivalent work
// apart from the optimized data access. These timings cover matrix
// construction, not the entire member-page request or HTML rendering.
const constructTrainingMatrixOld = (
  member: Member,
  sharedReadModel: SharedReadModel,
  quizData: FullQuizResultsForMember
): TrainingMatrix => {
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
      const quizResults = O.fromNullable(quizData.equipmentQuiz[equipment.id]);
      const isOwnerOfArea = O.fromNullable(member.ownerOf.find(o => o.id === equipment.area.id));
      const isTrainedOnEquipment = O.fromNullable(member.trainedOn.find(t => t.id === equipment.id));
      const isTrainerForEquipment = O.fromNullable(member.trainerFor.find(t => t.equipment_id === equipment.id));
      if (O.isNone(quizResults) && O.isNone(isOwnerOfArea) && O.isNone(isTrainedOnEquipment) && O.isNone(isTrainerForEquipment)) {
        return [];
      }
      return [{
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        area: {
          ...equipment.area,
          is_owner: pipe(isOwnerOfArea, O.map(o => o.ownershipRecordedAt)),
        },
        equipment_quiz: pipe(
          quizResults,
          O.getOrElse<TrainingMatrix[0]['equipment'][0]['equipment_quiz']>(
            () => ({
              passedAt: [],
              attempted: [],
            })
          )
        ),
        is_owner: pipe(
        isOwnerOfArea,
        O.map(
          o => o.ownershipRecordedAt
        )
        ),
        is_trained: pipe(
          isTrainedOnEquipment,
          O.map(
            t => t.trainedAt
          )
        ),
        is_trainer: pipe(
          isTrainerForEquipment,
          O.map(
            t => t.since
          )
        ),
      }];
    }
  );

  const result: {
    area: TrainingMatrix[0]['area'],
    equipment: TrainingMatrix[0]['equipment'][0][],
  }[] = [];
  let currentArea: O.Option<typeof result[0]> = O.none;
  for (const entry of equipmentEntries) {
    // We know these are sorted by area then equipment name.
    if (O.isNone(currentArea)) {
      // First entry.
      currentArea = O.some({
        area: entry.area,
        equipment: [entry],
      });
      continue;
    }

    if (currentArea.value.area.id !== entry.area.id) {
      // We must have moved onto a new area.
      result.push(currentArea.value);
      currentArea = O.some({
        area: entry.area,
        equipment: [entry],
      });
      continue
    }

    // We must still be aggregating the current area.
    currentArea.value.equipment.push(entry);
  }

  if (O.isSome(currentArea)) {
    result.push(currentArea.value);
  }

  for (const ownerOfArea of member.ownerOf) {
    if (result.some(area => area.area.id === ownerOfArea.id)) {
      continue;
    }

    result.push({
      area: {
        id: ownerOfArea.id as TrainingMatrix[0]['area']['id'],
        name: ownerOfArea.name,
        is_owner: O.some(ownerOfArea.ownershipRecordedAt),
      },
      equipment: [],
    });
  }

  return result.toSorted((a, b) => a.area.name.localeCompare(b.area.name, ['en-US']));
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

  console.log(`Node ${process.version}; measuring training-matrix construction only`);

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
        equipmentId: machineIdsForFixture[(i * TRAINING_RECORDS_PER_MEMBER + t) % machineIdsForFixture.length],
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

  console.log(`Fixture: ${AREAS} areas, ${machineIdsAll.length} machines, ${MEMBERS + 1} members (including viewer), ${MEMBERS * TRAINING_RECORDS_PER_MEMBER + Math.min(AREAS, machineIdsAll.length)} training records`);
  deepStrictEqual(
    constructTrainingMatrix(viewer, rm, quizData),
    constructTrainingMatrixOld(viewer, rm, quizData)
  );
  console.log('Old and new training matrices are identical');

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
